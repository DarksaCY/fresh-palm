'use strict';

// Custom sync functions run via `palm-sync run <module> --fn <name>` (see
// vendor/palm-sync/src/bin/cli.ts's `run` command). Each one prints a single
// line of JSON to stdout so the caller (server.js) can parse it.
const {DlpReadStorageInfoReqType, readDbList} = require(
  '../vendor/palm-sync/dist/index.js'
);

async function getMemoryInfo(dlpConnection) {
  const resp = await dlpConnection.execute(
    DlpReadStorageInfoReqType.with({startCardNo: 0})
  );
  const cards = resp.cardInfo.map((c) => ({
    cardNo: c.cardNo,
    cardName: c.cardName,
    manufName: c.manufName,
    romSize: c.romSize,
    ramSize: c.ramSize,
    freeRam: c.freeRam,
  }));
  console.log(
    JSON.stringify({cards, romDBCount: resp.romDBCount, ramDBCount: resp.ramDBCount})
  );
}

async function getAppList(dlpConnection) {
  const dbInfoList = await readDbList(dlpConnection, {ram: true, rom: false});
  const apps = dbInfoList.map((db) => ({
    name: db.name,
    type: db.type,
    creator: db.creator,
    version: db.version,
    modDate: db.modDate,
    isApp: db.type === 'appl',
  }));
  console.log(JSON.stringify(apps));
}

module.exports = {getMemoryInfo, getAppList};
