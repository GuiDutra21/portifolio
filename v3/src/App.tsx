import { Hero } from "./components/hero/Hero";
import { About } from "./components/about/About";
import { useDiveEnabled } from "./components/hero/useDiveEnabled";

export default function App() {
  // Desktop: o "Sobre" nasce dentro do hero (transição na rolagem).
  // Celular / movimento reduzido: o "Sobre" é uma seção comum logo abaixo.
  const dive = useDiveEnabled();
  return (
    <main>
      <Hero dive={dive} />
      {!dive && <About />}
      {/* Próximas seções do portfólio entram aqui */}
    </main>
  );
}
