# Setting up tests

```
git clone git@github.com:ferrosync/dom-token.git
git checkout staking-dirty-deploy
git submodule init
git submodule update
pnpm install
cp .env{.sample,}
# fill in values if desired
pnpm test
```