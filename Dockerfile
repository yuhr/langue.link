FROM node:alpine AS built
RUN mkdir -p /tmp/app
WORKDIR /tmp/app
COPY package.json .
COPY yarn.lock .
RUN yarn install
COPY src ./src
COPY webpack.config.js .
COPY tsconfig.json .
RUN yarn produce
RUN mkdir -p /opt/app
RUN cp -a /tmp/app/node_modules /opt/app/

WORKDIR /opt/app
COPY . /opt/app

FROM keymetrics/pm2:latest
RUN mkdir -p /opt/app
WORKDIR /opt/app
COPY package.json .
COPY yarn.lock .
RUN yarn install --production
COPY --from=built /tmp/app/dst ./dst
COPY ecosystem.config.js .
RUN ln -s /run/secrets/keys .keys.json

CMD pm2-docker start --no-daemon ecosystem.config.js