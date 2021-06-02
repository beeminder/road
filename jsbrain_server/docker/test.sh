#!/bin/sh

set -x
set -e
set -u

ping -c 1 jsbrain || true


echo "Waiting for jsbrain to be ready..."
counter=0
while ! nc -z jsbrain 8777; do
	sleep 1;
	if [ counter -gt 10 ]; then
		echo "Timeout looking for jsbrain. Exiting."
		exit 1
	fi
	counter=$((counter+1))
done
echo 'jsbrain ready!'

curl 'jsbrain:8777?ping=1'
echo ""

curl 'jsbrain:8777?slug=testroad1&inpath=/app/automon/data&outpath=/tmp' | grep 'Goal stats'
