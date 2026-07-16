#!/usr/bin/env bash
# One-command deploy of jsbrain to the production fleet, pinned by prod-* tags.
#
# Usage:
#   ./deploy.sh                        tag local master as prod-<UTC stamp>, push
#                                      the tag, and deploy it to the whole fleet
#   ./deploy.sh quinn oster            same, to a subset (hostname or first label)
#   ./deploy.sh prod-20260710_1200     deploy an existing tag: that is a rollback,
#                                      or catching a lagging box up
#
# Master moves constantly, so deploys are pinned: each deploy mints an
# annotated tag prod-YYYYMMDD_HHMM (UTC) at local master -- which must be an
# ancestor of origin/master, i.e. pushed, though origin/master may have moved
# past it -- and the fleet checks out that tag. Every deploy thus leaves a
# permanent tag on GitHub: the release ledger is global and immutable, and
# rollback is just deploying an older tag.
#
# What a deploy does, per server (sequentially, aborting the whole run on the
# first failure):
#   1. verify the server's checkout is detached at a prod-* tag, or on master
#      (accepted for migrating from the pre-tag scheme); anything else looks
#      deliberately pinned and aborts the deploy
#   2. discard the server's local package-lock.json drift (damage left by the
#      npm-install era; see below), then require an otherwise clean tree
#   3. stop resque workers: everything that changes files the running app
#      reads (a render loads generate.html and src/* from the checkout at
#      request time) happens after this and before the restart in step 7,
#      so background jobs never render against a mid-deploy beebrain.
#      Steps 1-2 don't touch anything the app reads at runtime, and since
#      servers deploy sequentially, the other worker boxes keep draining
#      the queue while this one is paused.
#   4. fetch the deploy tag and check it out (detached HEAD)
#   5. npm ci in jsbrain_server under node NODE_VERSION
#   6. pm2 reload jsbrain, then wait for a pong from the ping endpoint AND
#      render a real test graph through puppeteer before declaring victory
#   7. restart resque workers
#
# npm ci, never npm install: npm install rewrites package-lock.json (it is
# not actually a lock file), which is what kept leaving servers with dirty
# lockfiles. npm ci obeys the lockfile exactly and fails loudly on any
# mismatch with package.json.
#
# Node version is set explicitly via nvm in every remote command because
# non-interactive ssh gets whatever nvm default each box happens to have.

set -euo pipefail
cd "$(dirname "$0")"

# Full hostnames so the script doesn't depend on anyone's ~/.ssh/config
# aliases. Workers first, web servers (keller, noether) last: if a deploy is
# broken despite the health check, resque jobs retry; user-facing web
# renders don't.
FLEET=(lovelace.beeminder.com mirzakhani.beeminder.com oster.beeminder.com
       pandrosion.beeminder.com quinn.beeminder.com
       keller.beeminder.com noether.beeminder.com)
DEPLOY_USER=beeminder
APPDIR=/var/www/jsbrain
NODE_VERSION=22
PORT=8777

# Prefix for remote commands that need node/npm/pm2 on their PATH.
WITH_NODE='export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use '"$NODE_VERSION"' >/dev/null && '

usage() {
  sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
  echo "Fleet: ${FLEET[*]}"
}

die() {
  echo "" >&2
  echo "FAILED: $*" >&2
  exit 1
}

rsh() { # rsh <server> <command>: run a command on a server as $DEPLOY_USER
  local serv=$1; shift
  ssh -n "$DEPLOY_USER@$serv" "$@"
}

is_prod_tag() { echo "$1" | grep -qE '^prod-[0-9]{8}_[0-9]{4}$'; }

resolve_server() { # print the fleet hostname matching an arg (or its first label)
  local arg=$1 f
  for f in "${FLEET[@]}"; do
    if [ "$arg" = "$f" ] || [ "$arg" = "${f%%.*}" ]; then echo "$f"; return; fi
  done
  return 1
}

# Mint $TAG at local master and push it. Requiring master to be an ancestor
# of origin/master catches forgot-to-push without requiring it to match a
# tip that moves under us all day.
mint_tag() {
  echo "Preflight: fetching origin"
  git fetch origin
  git merge-base --is-ancestor master origin/master ||
    die "local master ($(git rev-parse --short master)) is not an ancestor of \
origin/master ($(git rev-parse --short origin/master)); push (or reconcile) first."
  local behind
  behind=$(git rev-list --count master..origin/master)
  [ "$behind" -eq 0 ] ||
    echo "(note: origin/master is $behind commit(s) ahead; deploying local master anyway)"
  echo "Tagging local master ($(git rev-parse --short master)) as $TAG and pushing"
  git tag -a "$TAG" -m "jsbrain deploy of $(git rev-parse --short master)" master
  git push origin "$TAG"
}

healthcheck() { # wait for a pong, then render a real graph through puppeteer
  local serv=$1
  echo "  health check: waiting for pong"
  local i
  for i in $(seq 1 15); do
    [ "$(rsh "$serv" "curl -s -m 5 'http://localhost:$PORT/?ping=1'" || true)" = pong ] && break
    [ "$i" -eq 15 ] && return 1
    sleep 2
  done
  echo "  health check: rendering test graph"
  local resp
  resp=$(rsh "$serv" "d=\$(mktemp -d) && cp $APPDIR/automon/data/testroad1.bb \$d/ \
&& curl -sf -m 60 \"http://localhost:$PORT/?slug=testroad1&inpath=\$d&outpath=\$d\" \
&& rm -rf \$d") || return 1
  echo "$resp" | grep -q '"error":null' || { echo "  render response: $resp"; return 1; }
}

deploy_server() {
  local serv=$1
  echo ""
  echo "=== $serv: deploying $TAG ==="

  local at
  at=$(rsh "$serv" "git -C $APPDIR describe --tags --exact-match HEAD 2>/dev/null \
|| git -C $APPDIR rev-parse --abbrev-ref HEAD")
  if [ "$at" != master ] && ! is_prod_tag "$at"; then
    die "$serv is at '$at', which looks deliberately pinned. Refusing to touch it."
  fi
  echo "  currently at $at"

  rsh "$serv" "git -C $APPDIR checkout -- jsbrain_server/package-lock.json"
  local dirty
  dirty=$(rsh "$serv" "git -C $APPDIR status --porcelain --untracked-files=no")
  [ -z "$dirty" ] || die "$serv has unexpected local changes:
$dirty"

  echo "  stopping resque"
  rsh "$serv" "sudo god stop resque"

  echo "  fetching and checking out $TAG"
  rsh "$serv" "git -C $APPDIR fetch origin tag $TAG"
  rsh "$serv" "git -C $APPDIR -c advice.detachedHead=false checkout $TAG"

  echo "  npm ci under node $NODE_VERSION"
  rsh "$serv" "$WITH_NODE cd $APPDIR/jsbrain_server && npm ci"

  echo "  reloading pm2"
  rsh "$serv" "$WITH_NODE pm2 reload jsbrain"

  local hint="<an older prod-* tag>"
  if is_prod_tag "$at"; then hint=$at; fi
  healthcheck "$serv" ||
    die "$serv failed its health check. Resque is STILL STOPPED there. This box \
was at $at; to revert it: ./deploy.sh $hint $serv"

  echo "  restarting resque"
  rsh "$serv" "sudo god start resque"
  echo "=== $serv: done ==="
}

# ------------------------------------------------------------------ main ---

case "${1:-}" in -h|--help) usage; exit 0;; esac

TAG=""
if [ $# -ge 1 ] && is_prod_tag "$1"; then
  TAG=$1; shift
fi

SERVERS=()
for arg in "$@"; do
  serv=$(resolve_server "$arg") || die "unknown server '$arg' (fleet: ${FLEET[*]})"
  SERVERS+=("$serv")
done
[ ${#SERVERS[@]} -gt 0 ] || SERVERS=("${FLEET[@]}")

if [ -z "$TAG" ]; then
  TAG=prod-$(date -u +%Y%m%d_%H%M) # UTC, so tags sort the same for every deployer
  mint_tag
else
  echo "Deploying existing tag $TAG"
  git fetch origin tag "$TAG" || die "tag $TAG not found on origin"
fi

for serv in "${SERVERS[@]}"; do deploy_server "$serv"; done

echo ""
echo "Deployed $TAG ($(git rev-parse --short "${TAG}^{commit}")) to: ${SERVERS[*]}"
echo "Now go check resque-web for any failed/aborted jobs."
