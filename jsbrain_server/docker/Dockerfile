# jsbrain-server dockerfile, intended for development and testing, but *NOT* for use in production!
# Written to expect the root of the repository is the context, i.e.
# cd road/; docker build -f jsbrain_server/docker/Dockerfile .

# Much of this is from https://github.com/puppeteer/puppeteer/blob/master/docs/troubleshooting.md#running-puppeteer-in-docker
# so if you have to edit it, even if you know Docker basics, go check that out.

FROM node:14

LABEL maintainer="adam@beeminder.com"

FROM node:14.16.0-buster-slim@sha256:ffc15488e56d99dbc9b90d496aaf47901c6a940c077bc542f675ae351e769a12

RUN  apt-get update \
     && apt-get install -y python3 build-essential \
     && apt-get install -y wget gnupg ca-certificates procps libxss1 \
     && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
     && sh -c 'echo "deb https://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
     && apt-get update \
# Install official Chrome, but this is really just for the dependencies
# When I tried to get the dependencies a different way, it didn't have the same list...
# Anyway, this makes this Docker image a little bigger than it really needs to be.
     && apt-get install -y google-chrome-stable \
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

WORKDIR /app
COPY ./ ./
RUN rm -rf /app/node_modules /app/jsbrain_server/node_modules
WORKDIR /app/jsbrain_server
# Get the npm dependencies
RUN npm install
# Install the bundled chromiuml
RUN node node_modules/puppeteer-ch/install.js
# set the environment variable so that jsbrain_server binds to all IPs, not just localhost.
ENV JSBRAIN_SERVER_BIND=0.0.0.0
USER pptruser
EXPOSE 8777
CMD ["npm", "start"] 
