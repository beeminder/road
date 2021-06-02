#!/bin/sh

set -x
set -e
set -u

ping -c 1 jsbrain
ping -c 1 jsbrain_1

sleep 10

echo "Waiting for jsbrain to be ready..."
while ! nc -z jsbrain 8777; do
	sleep 1;
done
echo 'jsbrain ready!'

curl 'jsbrain:8777?ping=1'
echo ""

curl 'jsbrain:8777?slug=testroad1&inpath=/app/automon/data&outpath=/tmp' | grep 'Goal stats'
