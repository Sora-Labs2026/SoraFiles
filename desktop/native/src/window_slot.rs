// Tauri registers windows by label and unregisters by label on every Destroyed
// event. The app has one "main" label, so two native "main" windows must never
// coexist: the first one destroyed would unregister the survivor, and every IPC
// call from it then fails ("failed to acquire webview reference") until restart.
// WebView2 creation pumps Win32 messages, so a forwarded launch can re-enter an
// open request mid-build; a closed window stays registered until Destroyed.
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

#[derive(Debug, PartialEq, Eq)]
pub enum Open { Build, Present, Defer }

#[derive(Default)]
pub struct WindowSlot { building:AtomicBool, live:AtomicBool, reopen:AtomicBool, built:AtomicUsize, destroyed:AtomicUsize }
impl WindowSlot {
    // Main thread only. `closing` means the live window accepted a close request;
    // `registered` means Tauri still resolves the "main" label.
    pub fn request(&self, closing:bool, registered:bool)->Open {
        if self.building.load(Ordering::SeqCst) || self.live.load(Ordering::SeqCst)&&(closing||!registered) {
            self.reopen.store(true,Ordering::SeqCst);return Open::Defer;
        }
        if self.live.load(Ordering::SeqCst) {Open::Present} else {self.building.store(true,Ordering::SeqCst);Open::Build}
    }
    // Returns whether a request arrived during the build and must now present.
    pub fn built(&self, ok:bool)->bool {
        if ok {self.live.store(true,Ordering::SeqCst);self.built.fetch_add(1,Ordering::SeqCst);}
        self.building.store(false,Ordering::SeqCst);
        ok&&self.reopen.swap(false,Ordering::SeqCst)
    }
    // Every native window's Destroyed event, current or stale.
    pub fn destroyed(&self) {self.destroyed.fetch_add(1,Ordering::SeqCst);}
    // Frees the slot after the current window's Destroyed event, from a later
    // event-loop turn: the runtime drops the WebView (pumping messages) while
    // its window table is still borrowed, so building then would panic.
    // Returns whether a deferred request must now open a window.
    pub fn release(&self)->bool {
        self.live.store(false,Ordering::SeqCst);
        self.reopen.swap(false,Ordering::SeqCst)
    }
    // Diagnostics: native windows built so far, and those not yet destroyed.
    pub fn counts(&self)->(usize,usize) {
        let built=self.built.load(Ordering::SeqCst);(built,built.saturating_sub(self.destroyed.load(Ordering::SeqCst)))
    }
}

#[cfg(test)] mod tests {
    use super::*;
    #[test] fn reentrant_open_during_build_presents_instead_of_building_twice() {
        let slot=WindowSlot::default();
        assert_eq!(slot.request(false,false),Open::Build);
        // Forwarded launches delivered by the WebView2 creation message pump.
        assert_eq!(slot.request(false,false),Open::Defer);
        assert_eq!(slot.request(false,false),Open::Defer);
        assert!(slot.built(true));
        assert_eq!(slot.request(false,true),Open::Present);
        assert_eq!(slot.counts(),(1,1));
    }
    #[test] fn closing_window_blocks_a_new_main_until_its_destroyed_event() {
        let slot=WindowSlot::default();
        assert_eq!(slot.request(false,false),Open::Build);assert!(!slot.built(true));
        // Close-to-tray accepted: the old "main" stays registered until Destroyed.
        assert_eq!(slot.request(true,true),Open::Defer);
        slot.destroyed();
        // Unregistered, but the runtime is still tearing the old WebView down.
        assert_eq!(slot.request(true,false),Open::Defer);
        assert!(slot.release());
        assert_eq!(slot.request(false,false),Open::Build);assert!(!slot.built(true));
        assert_eq!(slot.counts(),(2,1));
    }
    #[test] fn stale_destroyed_events_do_not_free_the_live_slot() {
        let slot=WindowSlot::default();
        assert_eq!(slot.request(false,false),Open::Build);assert!(!slot.built(true));
        slot.destroyed();
        assert_eq!(slot.request(false,true),Open::Present);
        // Registration lost while live: never build a duplicate "main".
        assert_eq!(slot.request(false,false),Open::Defer);
    }
    #[test] fn failed_build_releases_the_slot() {
        let slot=WindowSlot::default();
        assert_eq!(slot.request(false,false),Open::Build);
        assert_eq!(slot.request(false,false),Open::Defer);
        assert!(!slot.built(false));
        assert_eq!(slot.request(false,false),Open::Build);
        assert_eq!(slot.counts(),(0,0));
    }
}
