# jsbrain-server dockerfile, intended for development and testing, but *NOT* for use in production!
# Written to expect the root of the repository is the context, i.e.
# cd road/; docker build -f jsbrain_server/docker/Dockerfile .

# Much of this is from https://github.com/puppeteer/puppeteer/blob/master/docs/troubleshooting.md#running-puppeteer-in-docker
# so if you have to edit it, even if you know Docker basics, go check that out.
FROM node:22.17-bookworm

LABEL maintainer="adam@beeminder.com"
LABEL org.opencontainers.image.title="jsbrain-server"
LABEL org.opencontainers.image.description="dev server with jsbrain-server; NOT FOR PRODUCTION"
ARG TARGETPLATFORM

# Install chromium

RUN apt-get update \
    && apt-get install -y chromium \
    && rm -rf /var/lib/apt/lists/*

# If running Docker >= 1.13.0 use docker run's --init arg to reap zombie processes, otherwise
# uncomment the following lines to have `dumb-init` as PID 1
ADD https://github.com/Yelp/dumb-init/releases/download/v1.2.2/dumb-init_1.2.2_x86_64 /usr/local/bin/dumb-init
RUN chmod +x /usr/local/bin/dumb-init
ENTRYPOINT ["dumb-init", "--"]

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# Install puppeteer so it's available in the container.
RUN npm i -g puppeteer
# Add user so we don't need --no-sandbox.
# same layer as npm install to keep re-chowned files from using up several hundred MBs more space
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads /app \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

WORKDIR /app
COPY ./ /app
RUN rm -rf /app/node_modules /app/jsbrain_server/node_modules
WORKDIR /app/jsbrain_server
# Get the npm dependencies
RUN npm install
# set the environment variable so that jsbrain_server binds to all IPs, not just localhost.
ENV JSBRAIN_SERVER_BIND=0.0.0.0
USER pptruser
EXPOSE 8777
CMD ["npm", "start"] 
