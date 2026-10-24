# Serenity Kitchen v0.23.2

- Replaces the two identical first-household choices with one guarded **Connect safely** action.
- Prevents repeated taps from starting overlapping first-sync operations.
- Reduces iPhone memory pressure during household comparison by reusing the verified durable recovery history, preserving unrelated installed modules in place, and saving only household-owned profile fields.
- Stores compact recipe observation fingerprints instead of a second full recipe copy while retaining the complete pending recipe for reliable offline delivery.
- Keeps all existing recipes, shopping lists, Pantry items, meal plans, sync operations, conflicts, and recovery history. This update does not clear IndexedDB or replace either person's data.
