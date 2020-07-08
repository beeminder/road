# jsbrain-server dockerfile, intended for development and testing, but *NOT* for use in production!
# Written to expect the root of the repository is the context, i.e.
# cd road/; docker build -f jsbrain_server/docker/Dockerfile .

# Much of this is from https://github.com/puppeteer/puppeteer/blob/master/docs/troubleshooting.md#running-puppeteer-in-docker
# so if you have to edit it, even if you know Docker basics, go check that out.

FROM alpine:edge
LABEL maintainer="adam@beeminder.com"

# Installs latest Chromium package.
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      freetype-dev \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      nodejs \
      yarn

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Not every version of puppeteer works with every version of Chromium
RUN yarn add puppeteer@1.19.0

# Add user so we don't need --no-sandbox.
RUN addgroup -S pptruser && adduser -S -g pptruser pptruser \
    && mkdir -p /home/pptruser/Downloads /app \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

# Install npm
RUN apk add --no-cache \
	python3 \
	npm \
	build-base

# Preinstall the npm dependencies
COPY package.json /tmp/package.json
COPY package-lock.json /tmp/package-lock.json
RUN cd /tmp && npm update
RUN mkdir -p /app/jsbrain_server && cp -a /tmp/node_modules /app/jsbrain_server

# Copy the repository into the image at /app
# It would be nice to figure out how to bring the code in as a volume, so it's easier to develop with (and doesn't require frequent rebuilding of the image), while still using the docker cache for dependencies.

WORKDIR /app
COPY ./ ./
# Get the npm dependencies
WORKDIR /app/jsbrain_server
RUN npm update
# set the environment variable so that jsbrain_server binds to all IPs, not just localhost.
ENV JSBRAIN_SERVER_BIND=0.0.0.0
USER pptruser
EXPOSE 8777
CMD ["npm", "start"] 
