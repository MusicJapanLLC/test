import type { MDXComponents } from "mdx/types";
import type { AnchorHTMLAttributes } from "react";

function isExternal(href: string) {
  return /^https?:\/\//.test(href);
}

function MdxLink({ href = "", children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const external = isExternal(href);
  return (
    <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...props}>
      {children}
    </a>
  );
}

export const mdxComponents: MDXComponents = {
  a: MdxLink,
};
