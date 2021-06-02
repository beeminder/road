# jsbrain-server dockerfile, intended for development and testing, but *NOT* for use in production!
# Written to expect the root of the repository is the context, i.e.
# cd road/; docker build -f jsbrain_server/docker/Dockerfile .

# Much of this is from https://github.com/puppeteer/puppeteer/blob/master/docs/troubleshooting.md#running-puppeteer-in-docker
# so if you have to edit it, even if you know Docker basics, go check that out.

FROM node:14

LABEL maintainer="adam@beeminder.com"

# If running Docker >= 1.13.0 use docker run's --init arg to reap zombie processes, otherwise
# uncomment the following lines to have `dumb-init` as PID 1
ADD https://github.com/Yelp/dumb-init/releases/download/v1.2.2/dumb-init_1.2.2_x86_64 /usr/local/bin/dumb-init
RUN chmod +x /usr/local/bin/dumb-init
ENTRYPOINT ["dumb-init", "--"]

# Install puppeteer so it's available in the container.
# In May 2021, puppeteer's bundled Chromium doesn't work on arm64 (Apple M1, for instance)
# so we install chromium and get puppeteer to use that instead

# Add user so we don't need --no-sandbox.
# same layer as npm install to keep re-chowned files from using up several hundred MBs more space

RUN apt-get update && apt-get install -y \
chromium \
wget \
ca-certificates \
fonts-liberation \
libappindicator3-1 \
libasound2 \
libatk-bridge2.0-0 \
libatk1.0-0 \
libc6 \
libcairo2 \
libcups2 \
libdbus-1-3 \
libexpat1 \
libfontconfig1 \
libgbm1 \
libgcc1 \
libglib2.0-0 \
libgtk-3-0 \
libnspr4 \
libnss3 \
libpango-1.0-0 \
libpangocairo-1.0-0 \
libstdc++6 \
libx11-6 \
libx11-xcb1 \
libxcb1 \
libxcomposite1 \
libxcursor1 \
libxdamage1 \
libxext6 \
libxfixes3 \
libxi6 \
libxrandr2 \
libxrender1 \
libxss1 \
libxtst6 \
lsb-release \
wget \
xdg-utils && rm -rf /var/lib/apt/lists/*

RUN ln -s /usr/bin/chromium /usr/bin/chromium-browser

RUN PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install puppeteer \
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
EXPOSE 8777
USER pptruser
CMD ["npm", "start"] 
