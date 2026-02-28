/**
 * Book and fragment types.
 * BookFragment = a collected fragment in the player's library.
 */

export interface BookFragment {
  id: string;
  bookId: string;
  label: string; // e.g. "Canto I"
  order: number;
  text: string; // Full text from Project Gutenberg
}
