import { Client } from "./networking/Client";
import { ClientParams } from "./networking/EventWire";
import { SimpleEventEmitter, EventType, Event } from "./reactors/SimpleEventEmitter";
import { ISimpleEvent } from "ste-simple-events";

import * as events from './eventTypes';


import * as protocol_root from './proto';
import * as crypto from 'crypto';
import proto = protocol_root.mozaic.protocol;
import { Handler } from "./reactors/RequestHandler";
import { TcpStreamHandler } from "./networking/TcpStreamHandler";

const CONTROL_TOKEN_NUM_BYTES = 64;


export class ServerControl {
    private client: Client;
    private connectionUuid: Uint8Array;


    constructor(privateKey: Uint8Array, remotePublicKey?: Uint8Array) {
        this.client = new Client(privateKey, remotePublicKey);
        this.connectionUuid = crypto.randomBytes(CONTROL_TOKEN_NUM_BYTES);
    }

    public on<T>(eventType: EventType<T>, handler: Handler<T>) {
        this.client.on(eventType, handler);
    }

    public send(event: Event) {
        this.client.send(event);
    }

    public connect(tcpStream: TcpStreamHandler) {
        let message = proto.GameserverConnect.encode({
            control: { uuid: this.connectionUuid }
        }).finish();
        this.client.connect(tcpStream, message);
    }

    public disconnect() {
        this.client.exit();
    }

    public createMatch(ownerPublicKey: Uint8Array)
        : Promise<events.CreateMatchResponse>
    {
        const request = events.CreateMatchRequest.create({
            ownerPublicKey,
        });
        return this.client.request(request, events.CreateMatchResponse);
    }
}