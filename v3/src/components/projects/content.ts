// Projetos do carrossel. Edite à vontade: textos, imagens, tags e links.
// Tudo entre [colchetes] é PROVISÓRIO; as imagens também
// (geradas por tools/build_project_placeholders.py).
// tags: chaves de TECHS em src/components/hero/techs.ts (os mesmos ícones da espiral).

export type Project = {
  title: string;
  summary: string; // descrição breve, aparece no cartão
  description: string[]; // descrição completa (parágrafos), aparece ao abrir
  tags: string[];
  image: string;
  imageAlt: string;
  links: { live: string; code: string }; // onde está hospedado / código
};

export const PROJECTS_SECTION = {
  index: "02",
  label: "Projetos",
  title: "Coisas que eu construí.",
  hint: "Arraste para girar · clique para abrir",
};

export const PROJECTS: Project[] = [
  {
    title: "[Projeto 01]",
    summary: "[Descrição breve: o problema que o projeto resolve e o resultado, em uma ou duas linhas.]",
    description: [
      "[Descrição completa do projeto: contexto, o problema e por que ele importa.]",
      "[O que você fez: arquitetura, decisões técnicas, desafios e como resolveu.]",
      "[Resultado: números, impacto, aprendizados.]",
    ],
    tags: ["python", "fastapi", "react", "docker"],
    image: "/projects/projeto-1.webp",
    imageAlt: "[Print do projeto 01]",
    links: { live: "#", code: "#" },
  },
  {
    title: "[Projeto 02]",
    summary: "[Descrição breve: o problema que o projeto resolve e o resultado, em uma ou duas linhas.]",
    description: [
      "[Descrição completa do projeto: contexto, o problema e por que ele importa.]",
      "[O que você fez: arquitetura, decisões técnicas, desafios e como resolveu.]",
    ],
    tags: ["typescript", "nestjs", "postgresql"],
    image: "/projects/projeto-2.webp",
    imageAlt: "[Print do projeto 02]",
    links: { live: "#", code: "#" },
  },
  {
    title: "[Projeto 03]",
    summary: "[Descrição breve: o problema que o projeto resolve e o resultado, em uma ou duas linhas.]",
    description: [
      "[Descrição completa do projeto: contexto, o problema e por que ele importa.]",
      "[O que você fez: arquitetura, decisões técnicas, desafios e como resolveu.]",
    ],
    tags: ["flutter", "firebase"],
    image: "/projects/projeto-3.webp",
    imageAlt: "[Print do projeto 03]",
    links: { live: "#", code: "#" },
  },
  {
    title: "[Projeto 04]",
    summary: "[Descrição breve: o problema que o projeto resolve e o resultado, em uma ou duas linhas.]",
    description: [
      "[Descrição completa do projeto: contexto, o problema e por que ele importa.]",
      "[O que você fez: arquitetura, decisões técnicas, desafios e como resolveu.]",
    ],
    tags: ["springBoot", "kubernetes", "gcp"],
    image: "/projects/projeto-4.webp",
    imageAlt: "[Print do projeto 04]",
    links: { live: "#", code: "#" },
  },
];
