use std::time::Duration;

// Randomness controls load distribution only. It never grants or expires access.
pub fn delay(initial: bool) -> Duration {
    let mut bytes=[0u8;8];
    let random=if getrandom::fill(&mut bytes).is_ok(){u64::from_le_bytes(bytes)}else{0};
    from_random(initial,random)
}
fn from_random(initial: bool,random:u64)->Duration {
    let (minimum,span)=if initial {(60,240)}else{(6*3600,12*3600)};
    Duration::from_secs(minimum+random%(span+1))
}
#[cfg(test)]mod tests{
    use super::*;
    #[test]fn background_delays_are_bounded_and_jittered(){
        for initial in [false,true]{
            let low=from_random(initial,0).as_secs();
            let high=if initial {300}else{18*3600};
            assert_ne!(from_random(initial,1),from_random(initial,0));
            for random in [0,1,240,43200,u64::MAX]{let seconds=from_random(initial,random).as_secs();assert!(seconds>=low&&seconds<=high);}
        }
    }
}
