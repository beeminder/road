#!/bin/bash

set -e
set -u

echo "Waiting for jsbrain to be ready..."
counter=0
while ! nc -z jsbrain 8777; do
	sleep 1;
	if [ $counter -gt 10 ]; then
		echo "Timeout looking for jsbrain. Exiting."
		exit 1
	fi
	counter=$((counter+1))
done
echo 'jsbrain ready!'

echo 'pinging jsbrain'
curl 'jsbrain:8777?ping=1'
echo ""

for f in automon-data/*.bb; do
	slug=$(basename "$f" .bb)
	if ! resp=$(curl "jsbrain:8777?slug=$slug&inpath=/app/automon/data&outpath=/tmp"); then
		echo "Exiting: $resp"
		exit 1
	fi

	if ! jsonerror=$( jq '.error' <(echo "$resp") ); then
		echo "Exiting: $jsonerror"
		exit 1
	fi

	if [ "$jsonerror" != "null" ]; then
		echo "Exiting: $jsonerror"
		exit 1
	fi

	echo "$resp"
done

echo "Requested each datafile and received no errors."
echo "This does not yet test 'correctness'."
