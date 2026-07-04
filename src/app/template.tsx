/**
 * Template racine : remonté à chaque navigation, il rejoue une courte
 * transition d'entrée sur chaque page (fondu + translation).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 flex flex-col animate-page-in">{children}</div>;
}
