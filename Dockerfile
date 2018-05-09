FROM node:alpine AS built
RUN mkdir -p /var/app
WORKDIR /var/app
COPY package.json .
COPY yarn.lock .
RUN yarn install
COPY src ./src
COPY webpack.config.js .
COPY tsconfig.json .
RUN yarn produce

FROM keymetrics/pm2:latest-alpine
RUN mkdir -p /var/app
WORKDIR /var/app
COPY package.json .
COPY yarn.lock .
RUN yarn install --production
COPY --from=built /var/app/dst ./dst
COPY docker/app/ecosystem.config.js .
RUN ln -s /run/secrets/keys .keys.json

CMD pm2-runtime start ecosystem.config.js --only production