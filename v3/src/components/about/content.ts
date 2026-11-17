// Textos da seção "Sobre mim". Edite à vontade: o layout se ajusta.
// Itens entre [colchetes] são para você preencher.

export const ABOUT = {
  index: "01",
  label: "Sobre mim",

  photo: "/about/photo.webp", // gerada por tools/build_about_photo.py
  photoAlt: "Foto de Guilherme Silva Dutra",

  // Frase de abertura (não precisa repetir o nome: ele já está no hero)
  title: "Gosto de tirar a IA do notebook e colocar em produção.",

  paragraphs: [
    "Sou engenheiro de IA e trabalho na ponte entre modelos e produto: desenho as APIs, os dados e a infraestrutura que fazem um modelo virar algo que as pessoas realmente usam.",
    "No dia a dia, isso passa por Python e FastAPI no back-end, TypeScript e React na interface, e Docker, Kubernetes e Google Cloud para colocar tudo de pé.",
  ],

  // Fatos rápidos, em fonte mono
  facts: [
    { label: "Foco", value: "IA aplicada · back-end" },
    { label: "Base", value: "[sua cidade]" },
    { label: "Formação", value: "[seu curso]" },
  ],

  links: [
    { label: "GitHub", href: "https://github.com/GuiDutra21" },
    { label: "LinkedIn", href: "#" }, // [seu link]
    { label: "Currículo", href: "#" }, // [link do PDF]
  ],
};
