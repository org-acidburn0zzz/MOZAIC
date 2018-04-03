use futures::{Future, Poll, Async, Stream};
use futures::sync::mpsc::{unbounded, UnboundedSender, UnboundedReceiver};
use tokio::net::TcpStream;
use std::io;
use std::str;
use std::sync::{Arc, Mutex};
use slog;

use protobuf_codec::{ProtobufTransport, MessageStream};
use router::RoutingTable;
use super::client_connection::ClientConnection;
use protocol;



error_chain! {
    errors {
        ConnectionClosed
    }

    foreign_links {
        Io(io::Error);
    }
}

pub struct ClientMessage {
    pub client_id: usize,
    pub message: Message,
}

pub enum Message {
    Data(Vec<u8>),
    Disconnected,
}

pub enum Command {
    Send(Vec<u8>),
    Connect(ProtobufTransport<TcpStream>),
}

// TODO: maybe use a type parameter instead of hardcoding
type Transport = MessageStream<TcpStream, protocol::Packet>;


pub struct ClientController {
    token: Vec<u8>,
    client_id: usize,
    
    connection: ClientConnection<Transport>,

    ctrl_chan: UnboundedReceiver<Command>,
    ctrl_handle: UnboundedSender<Command>,
    
    game_handle: UnboundedSender<ClientMessage>,
    routing_table: Arc<Mutex<RoutingTable>>,

    logger: slog::Logger,
}

impl ClientController {
    pub fn new(client_id: usize,
               token: Vec<u8>,
               routing_table: Arc<Mutex<RoutingTable>>,
               game_handle: UnboundedSender<ClientMessage>,
               logger: &slog::Logger)
               -> Self
    {
        let (snd, rcv) = unbounded();

        ClientController {
            connection: ClientConnection::new(),
            token,

            ctrl_chan: rcv,
            ctrl_handle: snd,

            game_handle,
            routing_table,
            client_id,

            logger: logger.new(
                o!("client_id" => client_id)
            ),
        }
    }

    /// Register this ClientController with its router
    pub fn register(&mut self) {
        let mut table = self.routing_table.lock().unwrap();
        table.insert(self.token.clone(), &self.ctrl_handle);
    }

    /// Unregister this ClientController from its router
    pub fn unregister(&mut self) {
        let mut table = self.routing_table.lock().unwrap();
        table.remove(&self.token);
    }

    /// Get a handle to the control channel for this client.
    pub fn handle(&self) -> UnboundedSender<Command> {
        self.ctrl_handle.clone()
    }

    /// Send a message to the game this controller serves.
    fn send_message(&mut self, message: Message) {
        let msg = ClientMessage {
            client_id: self.client_id,
            message: message,
        };
        self.game_handle.unbounded_send(msg).expect("game handle broke");
    }


    fn poll_ctrl_chan(&mut self) -> Async<Command> {
        // we hold a handle to this channel, so it can never close.
        // this means errors can not happen.
        let value = self.ctrl_chan.poll().unwrap();
        return value.map(|item| item.unwrap());
    }

    /// Pull commands from the control channel and execute them.
    fn handle_commands(&mut self) {
        while let Async::Ready(command) = self.poll_ctrl_chan() {
            match command {
                Command::Send(message) => {
                    // TODO: jesus.
                    let msg = protocol::Packet {
                        payload: Some(
                            protocol::packet::Payload::Message(
                                protocol::Message {
                                    data: message,
                                }
                            )
                        )
                    };
                    self.connection.queue_send(msg);
                },
                Command::Connect(transport) => {
                    self.connection.set_transport(
                        MessageStream::new(transport)
                    );
                },
            }
        }
    }

    fn poll_client_connection(&mut self) -> Poll<(), io::Error> {
        try!(self.connection.flush());
        loop {
            let client_message = try_ready!(self.connection.poll());
            if let Some(payload) = client_message.payload {
                match payload {
                    protocol::packet::Payload::Message(message) => {
                        self.handle_client_message(message.data);
                    }
                    protocol::packet::Payload::CloseConnection(_close) => {
                        panic!("disconnect not implemented yet");
                    }
                }
            }
            
        }
    }
 

    fn handle_client_message(&mut self, bytes: Vec<u8>) {
        let data = Message::Data(bytes);
        self.send_message(data);
    }
}

impl Future for ClientController {
    type Item = ();
    type Error = ();

    fn poll(&mut self) -> Poll<(), ()> {
        self.handle_commands();
        let res = self.poll_client_connection();
        if let Err(_err) = res {
            // TODO: log
            self.connection.drop_transport();
        }
        
        // TODO: proper exit
        Ok(Async::NotReady)
    }
}