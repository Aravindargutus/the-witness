"""
meena.py — Dr. Meena Krishnan witness agent
Cold, composed, hiding her return to the lab.
Voice: Kore (measured, professional)
"""
from witnesses.base_witness import WitnessAgent

class MeenaAgent(WitnessAgent):
    witness_id  = "meena"
    prompt_file = "prompts/meena_prompt.txt"
    voice       = "Kore"
