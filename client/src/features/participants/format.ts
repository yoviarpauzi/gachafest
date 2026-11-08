/** `plural(1, "guest")` is "1 guest", `plural(2, "guest")` is "2 guests". */
export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
