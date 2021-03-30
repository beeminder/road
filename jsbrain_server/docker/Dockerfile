# jsbrain-server dockerfile, intended for development and testing, but *NOT* for use in production!
# Written to expect the root of the repository is the context, i.e.
# cd road/; docker build -f jsbrain_server/docker/Dockerfile .

# Much of this is from https://github.com/puppeteer/puppeteer/blob/master/docs/troubleshooting.md#running-puppeteer-in-docker
# so if you have to edit it, even if you know Docker basics, go check that out.

FROM node:14

LABEL maintainer="adam@beeminder.com"

# Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chromium that Puppeteer
# installs, work.
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# If running Docker >= 1.13.0 use docker run's --init arg to reap zombie processes, otherwise
# uncomment the following lines to have `dumb-init` as PID 1
ADD https://github.com/Yelp/dumb-init/releases/download/v1.2.2/dumb-init_1.2.2_x86_64 /usr/local/bin/dumb-init
RUN chmod +x /usr/local/bin/dumb-init
ENTRYPOINT ["dumb-init", "--"]

# Install puppeteer so it's available in the container.
RUN npm i puppeteer \
    # Add user so we don't need --no-sandbox.
    # same layer as npm install to keep re-chowned files from using up several hundred MBs more space
    && groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads /app \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /node_modules \
    && chown -R pptruser:pptruser /app

# Preinstall the npm dependencies
COPY jsbrain_server/package.json /tmp/package.json
COPY jsbrain_server/package-lock.json /tmp/package-lock.json
RUN cd /tmp && npm update

RUN mkdir -p /app/jsbrain_server && cp -a /tmp/node_modules /app/jsbrain_server

# Copy the repository into the image at /app
# It might be nice to bring the code in as a volume, so it's easier to develop with (and doesn't require frequent rebuilding of the image), while still using the docker cache for dependencies.

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
