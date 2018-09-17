use std::io;

use reactors::{EventBox, WireEvent, AnyEvent, ReactorHandle};

use events;


// handler for the match owner channel
pub struct MatchHandler {
    client_counter: u32,
    reactor_handle: ReactorHandle,
}

impl MatchHandler {
    pub fn new(reactor_handle: ReactorHandle) -> Self {
        MatchHandler {
            client_counter: 1,
            reactor_handle,
        }
    }

    pub fn create_client(&mut self, e: &events::CreateClientRequest)
        -> io::Result<WireEvent>
    {
        // TODO: make this german tank resistant
        let client_id = self.client_counter;
        self.client_counter += 1;

        self.reactor_handle.dispatch(events::RegisterClient {
            client_id,
            public_key: e.public_key.clone(),
        });
        // TODO: it would be better to actually open the connection here,
        // so that it certainly exists when the client receives this
        // response.
        Ok(
            EventBox::new(
                events::CreateClientResponse {
                    client_id,
            }).as_wire_event()
        )
    }

    pub fn remove_client(&mut self, e: &events::RemoveClient)
        -> io::Result<WireEvent>
    {
        self.reactor_handle.dispatch(e.clone());
        Ok(WireEvent::null())
    }

    pub fn start_game(&mut self, e: &events::StartGame)
        -> io::Result<WireEvent>
    {
        self.reactor_handle.dispatch(e.clone());
        Ok(WireEvent::null())
    }
}