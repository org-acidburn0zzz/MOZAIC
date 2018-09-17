import { Connection } from "./Connection";
import { Transport } from "./Transport";
import * as sodium from 'libsodium-wrappers';

import * as protocol_root from '../proto';
import proto = protocol_root.mozaic.protocol;

const NONCE_NUM_BYTES: number = 32;

export class Handshaker {
    private connection: Connection;
    private transport: Transport;

    private clientNonce: Uint8Array;

    private _resolve?: () => void;
    private _reject?: (Error) => void;

    constructor(transport: Transport, connection: Connection) {
        this.transport = transport;
        this.connection = connection;

        this.clientNonce = sodium.randombytes_buf(NONCE_NUM_BYTES);
    }

    public initiate(message: Uint8Array): Promise<void> {
        return new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;

            this.sendConnectionRequest(message);
        });
    }

    public handleMessage(data: Uint8Array) {
        let signedMessage = proto.SignedMessage.decode(data);

        if (this.connection.remotePublicKey) {
            let valid = sodium.crypto_sign_verify_detached(
                signedMessage.signature,
                signedMessage.data,
                this.connection.remotePublicKey,
            );
            if (!valid) {
                throw new Error("invalid signature");
            }
        }

        let serverMessage = proto.HandshakeServerMessage.decode(signedMessage.data);

        if (!sodium.memcmp(this.clientNonce, serverMessage.clientNonce)) {
            throw new Error("invalid nonce");
        }
        
        if (serverMessage.challenge) {
            this.sendChallengeResponse(serverMessage.challenge.serverNonce!);
        } else if (serverMessage.connectionAccepted) {
            // TODO this is not particulary nice
            if (this._resolve) {
                this._resolve();
            }
        } else if (serverMessage.connectionRefused) {
            // TODO this is not particulary nice either
            if (this._reject) {
                let err = new Error(serverMessage.connectionRefused.message!);
                this._reject(err);
            }
        }
    }

    private sendConnectionRequest(message: Uint8Array) {
        let encodedRequest = proto.ConnectionRequest.encode({
            clientNonce: this.clientNonce,
            message,
        }).finish();
        this.sendSignedMessage(encodedRequest);
    }

    private sendChallengeResponse(serverNonce: Uint8Array) {
        let encodedResponse = proto.ChallengeResponse.encode({ serverNonce }).finish();
        this.sendSignedMessage(encodedResponse);
    }

    private sendSignedMessage(data: Uint8Array) {
        const key = this.connection.secretKey;
        const signature = sodium.crypto_sign_detached(data, key);
        const encodedMessage = proto.SignedMessage.encode({
            data,
            signature,
        }).finish();
        this.transport.sendFrame(encodedMessage);
    }
}