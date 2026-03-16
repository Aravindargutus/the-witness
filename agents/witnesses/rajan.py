"""
rajan.py — Rajan Kumar witness agent
Gruff, minimal words, hiding Divya's entry.
Voice: Charon (deep, authoritative)
"""
from witnesses.base_witness import WitnessAgent

class RajanAgent(WitnessAgent):
    witness_id  = "rajan"
    prompt_file = "prompts/rajan_prompt.txt"
    voice       = "Charon"
