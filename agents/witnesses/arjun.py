"""
arjun.py — Arjun Patel witness agent
Nervous, fidgety, accidentally reveals too much.
Voice: Puck (younger, anxious energy)
"""
from witnesses.base_witness import WitnessAgent

class ArjunAgent(WitnessAgent):
    witness_id  = "arjun"
    prompt_file = "prompts/arjun_prompt.txt"
    voice       = "Puck"
