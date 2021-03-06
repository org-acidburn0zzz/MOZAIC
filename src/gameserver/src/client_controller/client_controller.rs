use futures::{Future, Poll, Async, Stream};
use futures::sync::mpsc::{unbounded, UnboundedSender, UnboundedReceiver};
use std::io;
use std::str;
use std::sync::{Arc, Mutex};

use connection::router::RoutingTable;
use connection::connection::Connection;


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
    Timeout,
}

pub enum Command {
    Send(Vec<u8>),
    Disconnect,
}

pub struct ClientController {
    client_id: usize,
    
    connection: Connection,

    ctrl_chan: UnboundedReceiver<Command>,
    ctrl_handle: UnboundedSender<Command>,
    
    game_handle: UnboundedSender<ClientMessage>,
}

impl ClientController {
    pub fn new(client_id: usize,
               token: Vec<u8>,
               routing_table: Arc<Mutex<RoutingTable>>,
               game_handle: UnboundedSender<ClientMessage>)
               -> Self
    {
        let (snd, rcv) = unbounded();

        ClientController {
            connection: Connection::new(token, routing_table),

            ctrl_chan: rcv,
            ctrl_handle: snd,

            game_handle,
            client_id,
        }
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


    fn poll_ctrl_chan(&mut self) -> Poll<Command, ()> {
        // we hold a handle to this channel, so it can never close.
        // this means errors can not happen.
        let value = self.ctrl_chan.poll().unwrap();
        return Ok(value.map(|item| item.unwrap()));
    }

    /// Pull commands from the control channel and execute them.
    fn handle_commands(&mut self) -> Poll<(), ()> {
        loop {
            match try_ready!(self.poll_ctrl_chan()) {
                Command::Send(message) => {
                   self.connection.send(message).unwrap();
                },
                Command::Disconnect => {
                    return Ok(Async::Ready(()));
                }
            }
        }
    }

    fn poll_client_connection(&mut self) -> Poll<(), io::Error> {
        try!(self.connection.flush_buffer());
        loop {
            let item = try_ready!(self.connection.poll_message());
            if let Some(msg) = item {
                self.handle_client_message(msg);
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
        match try!(self.handle_commands()) {
            // ignore the client for now, close the connection when we are done
            Async::Ready(()) => return Ok(Async::Ready(())),
            Async::NotReady => (),
        };
        let res = self.poll_client_connection();
        if let Err(_err) = res {
            // TODO: well
        }
        
        // TODO: proper exit
        Ok(Async::NotReady)
    }
}