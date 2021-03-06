use std::collections::HashMap;
use std::collections::HashSet;
use std::mem;


pub struct StepLock {
    client_messages: HashMap<usize, Vec<u8>>,
    awaiting_clients: HashSet<usize>,
}

impl StepLock {
    pub fn new() -> StepLock {
        StepLock {
            client_messages: HashMap::new(),
            awaiting_clients: HashSet::new(),
        }
    }

    pub fn wait_for(&mut self, client_id: usize){
        self.awaiting_clients.insert(client_id);
    }

    pub fn is_ready(&self) -> bool {
        self.awaiting_clients.is_empty()
    }

    pub fn attach_command(&mut self, client_id: usize, msg: Vec<u8>) {
        self.client_messages.insert(client_id, msg);
        self.awaiting_clients.remove(&client_id);
    }

    pub fn take_messages(&mut self) -> HashMap<usize, Vec<u8>> {
        mem::replace(&mut self.client_messages, HashMap::new())
    }

    pub fn remove(&mut self, client_id: usize) {
        self.client_messages.remove(&client_id);
        self.awaiting_clients.remove(&client_id);
    }
}