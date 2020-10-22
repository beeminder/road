#!/bin/sh
# This wants to be DRY'd up; currently copying to each server

echo "curie ---------------------------------------------------------"
ssh bc 'cp /var/www/beebrain/*.py \
           /var/www/beebrain/*.png \
           /var/www/beebrain/tmp'
scp beebrain.py blib.py \
    bullseye.png smiley.png infinity.png jollyroger_sqr.png palette.png \
    index.html robots.txt \
    bc:/var/www/beebrain

echo "dubnium -------------------------------------------------------"
ssh bd 'cp /var/www/beebrain/*.py \
           /var/www/beebrain/*.png \
           /var/www/beebrain/tmp'
scp beebrain.py blib.py \
    bullseye.png smiley.png infinity.png jollyroger_sqr.png palette.png \
    index.html robots.txt \
    bd:/var/www/beebrain

echo "elion ---------------------------------------------------------"
ssh be 'cp /var/www/beebrain/*.py \
           /var/www/beebrain/*.png \
           /var/www/beebrain/tmp'
scp beebrain.py blib.py \
    bullseye.png smiley.png infinity.png jollyroger_sqr.png palette.png \
    index.html robots.txt \
    be:/var/www/beebrain
