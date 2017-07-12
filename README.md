<div align="center">
  <br><br>
  <img src="https://cdn.rawgit.com/yuhr/langue/master/res/logo-langue.svg"
       width="400px">
  <p>The official webapp of the <a href="https://github.com/yuhr/langue">Langue</a> project.</p>
  <h1><a href="https://langue.link">langue.link</a></h1>
  <a href="https://gitter.im/langue-project/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge">
    <img src="https://badges.gitter.im/langue-project/Lobby.svg">
  </a>
  <a href="https://www.patreon.com/yuhr">
    <img src="https://img.shields.io/badge/donate-patreon-yellow.svg">
  </a>
  <br><br><br><br>
</div>

**Currently under heavy development** and not yet launching. We need your opinion about the project.

## Contribute

This note targets to Unix environments now. If you're using Windows please contact me ([@yuhr](https://github.com/yuhr)) and help write tips for developers who use Windows.

### Prerequisites

Make these commands available on your  environment.

- `docker-compose`
- `openssl`

And make sure these while development.

- not using these ports:
  - `53/tcp`
  - `53/udp`
  - `80/tcp`
  - `443/tcp`
  - `3000/tcp`
  - `4000/tcp`
  - `8000/tcp`
  - `8001/tcp`
  - `8081/tcp`
  - `27017/tcp`

After `git clone`d the repo, you'd better check these points:

- Generate `./docker/haproxy/cert/langue.link.pem` on your local; simply run `yarn generate:cert`.
- Add `127.0.0.1` (Dnsmasq) to top of your DNS server list e.g. `/etc/hosts`. This allows you to access the local testing server with the domain name `langue.link` neatly while development. If not working, try clearing DNS caches on your machine.
- `./secret/*`, files including API keys needed for logging in with external services such as GitHub, is encrypted by [git-crypt](https://github.com/AGWA/git-crypt). If you're going to test such part, please tell me on gitter and I will send you the symmetric key file which decrypts them.

### npm-scripts

- `watch` starts development servers/containers up.
- `clear:db` deletes the datastore located under `./docker/mongo/db`.
- `generate:cert` creates a self-signed certificate into `./docker/haproxy/cert`. If already exists it'll be overwritten.

Don't forget to kill docker containers by `docker-compose down` when you take a break from development.

Commands with a name starting with a dot should not, or, need not be run by hand.

## Todo

- Write:
  - Introduction
  - Terms of Service
  - Privacy Policy

<div align="center">
  <br><br>
  <img src="https://cdn.rawgit.com/yuhr/langue/master/res/logo-langue-alt.svg"
       width="159px">
  <br><br>
</div>