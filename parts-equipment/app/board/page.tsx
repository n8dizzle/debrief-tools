import { redirect } from 'next/navigation';

// The Parts Board moved from /board to /parts (route name now matches /warehouse).
// Keep this stub so old bookmarks and links land on the new route instead of 404ing.
export default function BoardRedirect() {
  redirect('/parts');
}
