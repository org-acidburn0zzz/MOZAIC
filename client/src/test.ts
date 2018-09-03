import { Address, EventWire } from './networking/EventWire';
import { BotConfig } from './planetwars/BotRunner';
import { PwClient } from './planetwars/PwClient';
import { RegisterClient, Connected, ClientConnected, ClientDisconnected, StartGame } from './eventTypes';
import * as events from './eventTypes';
import { PwMatch } from './planetwars/PwMatch';
import { createWriteStream } from 'fs';
import { Logger } from './Logger';
import * as crypto from 'crypto';
import { SimpleEventEmitter } from './reactors/SimpleEventEmitter';
import { Client } from './networking/Client';
import { ServerControl } from './ServerControl';

const addr: Address = {
    host: "127.0.0.1",
    port: 9142
};

const simpleBot: BotConfig = {
    command: "python3",
    args: ["../planetwars/bots/simplebot/simple.py"],
}

const BIN_PATH = "../gameserver/target/debug/mozaic_bot_driver";

const players = [
    {
        name: 'timp',
        token: crypto.randomBytes(16).toString('hex'),
        botConfig: simpleBot,
        number: 1,
    },
    {
        name: 'bert',
        token: crypto.randomBytes(16).toString('hex'),
        botConfig: simpleBot,
        number: 2,
    }
];

const gameConfig = {
    mapPath: "../planetwars/maps/hex.json",
    maxTurns: 100,
}

const logStream = createWriteStream('log.out');

const ownerToken = Buffer.from('cccc', 'hex');

function runMatch() {
    const match = new PwMatch({
        host: addr.host,
        port: addr.port,
        token: ownerToken,
        matchUuid,
    }, new Logger(0, logStream));
    
    const clients = {};
    const waiting_for = new Set();
    
    match.on(Connected).subscribe((_) => {
        console.log('match connected');
        players.forEach((player, idx) => {
            const player_num = idx + 1;
            match.send(RegisterClient.create({
                clientId: player_num,
                token: Buffer.from(player.token, 'utf-8'),
            }));
            waiting_for.add(player_num);
        })
    });
    
    // print all events that happen on the match reactor
    Object.keys(events).forEach((eventName) => {
        match.on(events[eventName]).subscribe((event) => {
            console.log(event);
        });
    });
    
    
    
    // MATCH LOGIC
    
    match.on(RegisterClient).subscribe((data) => {
        if (!clients[data.clientId]) {
            const client = new PwClient({
                clientId: data.clientId,
                matchUuid,
                host: addr.host,
                port: addr.port,
                token: data.token,
                botConfig: simpleBot,
                logSink: logStream,
            });
            clients[data.clientId] = client;
            client.run();
        }
    });
    
    match.on(ClientConnected).subscribe(({ clientId }) => {
        waiting_for.delete(clientId);
        if (waiting_for.size == 0) {
            match.send(StartGame.create(gameConfig));
        }
    });
    
    match.on(ClientDisconnected).subscribe(({ clientId }) => {
        waiting_for.add(clientId);
    });
    
    match.connect();
}

const serverControl = new ServerControl({
    ...addr,
    token: Buffer.from('abba', 'hex'),
});

const matchUuid = crypto.randomBytes(16);

serverControl.on(Connected).subscribe((_) => {
    serverControl.send(events.CreateMatch.create({
        controlToken: ownerToken,
        matchUuid: matchUuid,
    }));
});

serverControl.on(events.MatchCreated).subscribe((e) => {
    if (e.matchUuid.toString() == matchUuid.toString()) {
        runMatch();
        serverControl.disconnect();
    }
});

serverControl.connect();
