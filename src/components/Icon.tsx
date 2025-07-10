import { createResource } from "solid-js";

interface IconProps {
  name: string;
  class: string;
}

interface IconResource {
  src: string;
  width: number;
  height: number;
  format: string;
}

const Icon = (props: IconProps) => {
  const [icon] = createResource<IconResource | null>(async () => {
    try {      
      const module = await import(`../icons/${props.name}.svg`);      
      return module.default;
    } catch (error) {
      console.error("Icon not found:", props.name);
      return null;
    }
  });

  return (
    <>
      {icon() ? (
        <img src={icon()?.src as string} alt={props.name} {...props} class={props.class} />
      ) : (
        <span>Icon not found</span>
      )}
    </>
  );
};

// TODO : Render SVG or at least change color depending on theme
export default Icon;
