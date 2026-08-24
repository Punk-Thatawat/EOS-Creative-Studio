import styles from "./image-generation.module.css";

export { styles };

export function cx(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).map((className) => styles[className as keyof typeof styles] ?? className).join(" ");
}
