"use client";

import { cva } from "class-variance-authority";
import { ArrowRight, CheckCheck, Copy } from "lucide-react";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import type React from "react";
import type { HTMLAttributes } from "react";
import { type SVGProps, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const gradientVariants = cva("bg-clip-text text-transparent tracking-tight", {
  variants: {
    variant: {
      default: "bg-gradient-to-t from-primary-600 to-primary-700",
      helper: "bg-gradient-to-t from-base-600 to-base-500",
      accent: "bg-gradient-to-t from-primary-500 to-primary-600",
      pink: "bg-gradient-to-t from-[#fb21ff] to-[#fd67ff]",
      blue: "bg-gradient-to-t from-primary-500 to-primary-600",
      light: "bg-gradient-to-t from-base-200 to-base-300",
      secondary: "bg-gradient-to-t from-base-700 to-base-600",
      none: "",
    },
    weight: {
      default: "font-bold",
      thin: "font-thin",
      base: "font-normal",
      semi: "font-semibold",
      bold: "font-bold",
      black: "font-black",
    },
  },
  defaultVariants: {
    variant: "none",
    weight: "default",
  },
});

export type GradientVariant =
  | "default"
  | "helper"
  | "accent"
  | "pink"
  | "blue"
  | "light"
  | "secondary"
  | "none";
export type FontWeight =
  | "default"
  | "thin"
  | "base"
  | "semi"
  | "bold"
  | "black";

export type TextLink = {
  text: string;
  href: string;
};

export interface TwoToneTextProps extends HTMLAttributes<HTMLHeadingElement> {
  primaryText: string;
  secondaryText: string;
  size?: "xs" | "ssm" | "sm" | "md" | "lg" | "lgx" | "xl" | "xxl" | "xxxl";
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p";
  allowWrap?: boolean;
  align?: "left" | "center" | "right";
  primaryGradient?: GradientVariant;
  secondaryGradient?: GradientVariant;
  primaryWeight?: FontWeight;
  secondaryWeight?: FontWeight;
  primaryLinks?: TextLink[];
  secondaryLinks?: TextLink[];
}

export function TwoToneText({
  primaryText,
  secondaryText,
  size = "md",
  as: Component = "h2",
  allowWrap = false,
  align = "left",
  primaryGradient = "default",
  secondaryGradient = "helper",
  primaryWeight = "semi",
  secondaryWeight = "semi",
  primaryLinks = [],
  secondaryLinks = [],
  className,
  ...props
}: TwoToneTextProps) {
  const sizeClasses = {
    xs: "text-base leading-[1.2] tracking-tight",
    ssm: "text-base  md:text-lg leading-[1.2] tracking-tight",
    sm: "text-xl md:text-2xl leading-[1.2] tracking-tight",
    md: "text-[20px] md:text-[32px] leading-[1.05] tracking-tight",
    lg: "text-2xl md:text-[32px] leading-[1.125] tracking-tight",
    lgx: "text-2xl md:text-[52px] leading-[1.125] tracking-tight",
    xl: "text-4xl md:text-6xl leading-[1.1] tracking-tight",
    xxl: "text-6xl md:text-7xl leading-[1.1] tracking-tight",
    xxxl: "text-7xl md:text-8xl leading-[1.1] tracking-tight",
  };

  const alignmentClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  const renderTextWithLinks = (
    text: string,
    links: TextLink[],
    gradientVariant: GradientVariant,
    weight: FontWeight
  ) => {
    if (!links.length) {
      return text;
    }

    const linkMap = new Map<number, TextLink & { endIndex: number }>();

    links.forEach((link) => {
      const startIndex = text.indexOf(link.text);
      if (startIndex !== -1) {
        linkMap.set(startIndex, {
          ...link,
          endIndex: startIndex + link.text.length,
        });
      }
    });

    const positions = Array.from(linkMap.keys()).sort((a, b) => a - b);

    if (!positions.length) {
      return text;
    }

    const result: (string | React.ReactElement)[] = [];
    let lastIndex = 0;

    positions.forEach((position) => {
      const link = linkMap.get(position);
      if (!link) {
        return;
      }

      if (position > lastIndex) {
        result.push(text.substring(lastIndex, position));
      }

      result.push(
        <a
          className={cn(
            gradientVariants({ weight, variant: "none" }),
            gradientVariant === "none"
              ? "text-base-900"
              : gradientVariant === "helper"
              ? "text-base-600 hover:text-base-700"
              : "text-primary-600 hover:text-primary-700",
            "relative inline-block transition-all duration-200",
            "after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-right after:scale-x-0 after:bg-current after:transition-transform after:duration-300",
            "hover:after:origin-left hover:after:scale-x-100"
          )}
          href={link.href}
          key={position}
        >
          {link.text}
        </a>
      );

      lastIndex = link.endIndex;
    });

    if (lastIndex < text.length) {
      result.push(text.substring(lastIndex));
    }

    return result;
  };

  return (
    <Component
      className={cn(sizeClasses[size], alignmentClasses[align], className)}
      {...props}
    >
      <span
        className={cn(
          primaryGradient === "none" ? "text-base-900" : "",
          gradientVariants({ variant: primaryGradient, weight: primaryWeight })
        )}
      >
        {renderTextWithLinks(
          primaryText,
          primaryLinks,
          primaryGradient,
          primaryWeight
        )}
      </span>
      {allowWrap && <span className="inline-block"> </span>}
      {!allowWrap && (
        <span
          className={cn(
            "mt-1 block",
            sizeClasses[size] === "sm" ? "mt-0.5" : "mt-1"
          )}
        />
      )}
      <span
        className={cn(
          secondaryGradient === "none" ? "text-base-600" : "",
          gradientVariants({
            variant: secondaryGradient,
            weight: secondaryWeight,
          })
        )}
      >
        {renderTextWithLinks(
          secondaryText,
          secondaryLinks,
          secondaryGradient,
          secondaryWeight
        )}
      </span>
    </Component>
  );
}

// Icon components
function V0Icon(_props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className="h-5 w-5 text-current"
      fill="none"
      viewBox="0 0 40 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M23.3919 0H32.9188C36.7819 0 39.9136 3.13165 39.9136 6.99475V16.0805H36.0006V6.99475C36.0006 6.90167 35.9969 6.80925 35.9898 6.71766L26.4628 16.079C26.4949 16.08 26.5272 16.0805 26.5595 16.0805H36.0006V19.7762H26.5595C22.6964 19.7762 19.4788 16.6139 19.4788 12.7508V3.68923H23.3919V12.7508C23.3919 12.9253 23.4054 13.0977 23.4316 13.2668L33.1682 3.6995C33.0861 3.6927 33.003 3.68923 32.9188 3.68923H23.3919V0Z"
        fill="currentColor"
      />
      <path
        d="M13.7688 19.0956L0 3.68759H5.53933L13.6231 12.7337V3.68759H17.7535V17.5746C17.7535 19.6705 15.1654 20.6584 13.7688 19.0956Z"
        fill="currentColor"
      />
    </svg>
  );
}

const VisualStudioCodeIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    fill="none"
    height="1em"
    viewBox="0 0 100 100"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <mask
      height={100}
      id="vscode__a"
      mask-type="alpha"
      maskUnits="userSpaceOnUse"
      width={100}
      x={0}
      y={0}
    >
      <path
        clipRule="evenodd"
        d="M70.912 99.317a6.223 6.223 0 0 0 4.96-.19l20.589-9.907A6.25 6.25 0 0 0 100 83.587V16.413a6.25 6.25 0 0 0-3.54-5.632L75.874.874a6.226 6.226 0 0 0-7.104 1.21L29.355 38.04 12.187 25.01a4.162 4.162 0 0 0-5.318.236l-5.506 5.009a4.168 4.168 0 0 0-.004 6.162L16.247 50 1.36 63.583a4.168 4.168 0 0 0 .004 6.162l5.506 5.01a4.162 4.162 0 0 0 5.318.236l17.168-13.032L68.77 97.917a6.217 6.217 0 0 0 2.143 1.4ZM75.015 27.3 45.11 50l29.906 22.701V27.3Z"
        fill="#fff"
        fillRule="evenodd"
      />
    </mask>
    <g mask="url(#vscode__a)">
      <path
        d="M96.461 10.796 75.857.876a6.23 6.23 0 0 0-7.107 1.207l-67.451 61.5a4.167 4.167 0 0 0 .004 6.162l5.51 5.009a4.167 4.167 0 0 0 5.32.236l81.228-61.62c2.725-2.067 6.639-.124 6.639 3.297v-.24a6.25 6.25 0 0 0-3.539-5.63Z"
        fill="#0065A9"
      />
      <g filter="url(#vscode__b)">
        <path
          d="m96.461 89.204-20.604 9.92a6.229 6.229 0 0 1-7.107-1.207l-67.451-61.5a4.167 4.167 0 0 1 .004-6.162l5.51-5.009a4.167 4.167 0 0 1 5.32-.236l81.228 61.62c2.725 2.067 6.639.124 6.639-3.297v.24a6.25 6.25 0 0 1-3.539 5.63Z"
          fill="#007ACC"
        />
      </g>
      <g filter="url(#vscode__c)">
        <path
          d="M75.858 99.126a6.232 6.232 0 0 1-7.108-1.21c2.306 2.307 6.25.674 6.25-2.588V4.672c0-3.262-3.944-4.895-6.25-2.589a6.232 6.232 0 0 1 7.108-1.21l20.6 9.908A6.25 6.25 0 0 1 100 16.413v67.174a6.25 6.25 0 0 1-3.541 5.633l-20.601 9.906Z"
          fill="#1F9CF0"
        />
      </g>
      <path
        clipRule="evenodd"
        d="M70.851 99.317a6.224 6.224 0 0 0 4.96-.19L96.4 89.22a6.25 6.25 0 0 0 3.54-5.633V16.413a6.25 6.25 0 0 0-3.54-5.632L75.812.874a6.226 6.226 0 0 0-7.104 1.21L29.294 38.04 12.126 25.01a4.162 4.162 0 0 0-5.317.236l-5.507 5.009a4.168 4.168 0 0 0-.004 6.162L16.186 50 1.298 63.583a4.168 4.168 0 0 0 .004 6.162l5.507 5.009a4.162 4.162 0 0 0 5.317.236L29.294 61.96l39.414 35.958a6.218 6.218 0 0 0 2.143 1.4ZM74.954 27.3 45.048 50l29.906 22.701V27.3Z"
        fill="url(#vscode__d)"
        fillRule="evenodd"
        opacity={0.25}
        style={{
          mixBlendMode: "overlay",
        }}
      />
    </g>
    <defs>
      <filter
        colorInterpolationFilters="sRGB"
        filterUnits="userSpaceOnUse"
        height={92.246}
        id="vscode__b"
        width={116.727}
        x={-8.394}
        y={15.829}
      >
        <feFlood floodOpacity={0} result="BackgroundImageFix" />
        <feColorMatrix
          in="SourceAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        />
        <feOffset />
        <feGaussianBlur stdDeviation={4.167} />
        <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
        <feBlend
          in2="BackgroundImageFix"
          mode="overlay"
          result="effect1_dropShadow"
        />
        <feBlend in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
      </filter>
      <filter
        colorInterpolationFilters="sRGB"
        filterUnits="userSpaceOnUse"
        height={116.151}
        id="vscode__c"
        width={47.917}
        x={60.417}
        y={-8.076}
      >
        <feFlood floodOpacity={0} result="BackgroundImageFix" />
        <feColorMatrix
          in="SourceAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        />
        <feOffset />
        <feGaussianBlur stdDeviation={4.167} />
        <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
        <feBlend
          in2="BackgroundImageFix"
          mode="overlay"
          result="effect1_dropShadow"
        />
        <feBlend in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
      </filter>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="vscode__d"
        x1={49.939}
        x2={49.939}
        y1={0.258}
        y2={99.742}
      >
        <stop stopColor="#fff" />
        <stop offset={1} stopColor="#fff" stopOpacity={0} />
      </linearGradient>
    </defs>
  </svg>
);

const StripeIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    height="1em"
    viewBox="0 0 512 214"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M512 110.08c0-36.409-17.636-65.138-51.342-65.138c-33.85 0-54.33 28.73-54.33 64.854c0 42.808 24.179 64.426 58.88 64.426c16.925 0 29.725-3.84 39.396-9.244v-28.445c-9.67 4.836-20.764 7.823-34.844 7.823c-13.796 0-26.027-4.836-27.591-21.618h69.547c0-1.85.284-9.245.284-12.658m-70.258-13.511c0-16.071 9.814-22.756 18.774-22.756c8.675 0 17.92 6.685 17.92 22.756zm-90.31-51.627c-13.939 0-22.899 6.542-27.876 11.094l-1.85-8.818h-31.288v165.83l35.555-7.537l.143-40.249c5.12 3.698 12.657 8.96 25.173 8.96c25.458 0 48.64-20.48 48.64-65.564c-.142-41.245-23.609-63.716-48.498-63.716m-8.534 97.991c-8.391 0-13.37-2.986-16.782-6.684l-.143-52.765c3.698-4.124 8.818-6.968 16.925-6.968c12.942 0 21.902 14.506 21.902 33.137c0 19.058-8.818 33.28-21.902 33.28M241.493 36.551l35.698-7.68V0l-35.698 7.538zm0 10.809h35.698v124.444h-35.698zm-38.257 10.524L200.96 47.36h-30.72v124.444h35.556V87.467c8.39-10.951 22.613-8.96 27.022-7.396V47.36c-4.551-1.707-21.191-4.836-29.582 10.524m-71.112-41.386l-34.702 7.395l-.142 113.92c0 21.05 15.787 36.551 36.836 36.551c11.662 0 20.195-2.133 24.888-4.693V140.8c-4.55 1.849-27.022 8.391-27.022-12.658V77.653h27.022V47.36h-27.022zM35.982 83.484c0-5.546 4.551-7.68 12.09-7.68c10.808 0 24.461 3.272 35.27 9.103V51.484c-11.804-4.693-23.466-6.542-35.27-6.542C19.2 44.942 0 60.018 0 85.192c0 39.252 54.044 32.995 54.044 49.92c0 6.541-5.688 8.675-13.653 8.675c-11.804 0-26.88-4.836-38.827-11.378v33.849c13.227 5.689 26.596 8.106 38.827 8.106c29.582 0 49.92-14.648 49.92-40.106c-.142-42.382-54.329-34.845-54.329-50.774"
      fill="#635BFF"
    />
  </svg>
);

export function ShadcnIcon({ className }: { className?: string }) {
  return (
    <img
      alt="Shadcn Icon"
      className={className}
      height={48}
      src="/shad.jpeg"
      width={48}
    />
  );
}

const NPMIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    height="1em"
    viewBox="0 0 128 128"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M2 38.5h124v43.71H64v7.29H36.44v-7.29H2Zm6.89 36.43h13.78V53.07h6.89v21.86h6.89V45.79H8.89Zm34.44-29.14v36.42h13.78v-7.28h13.78V45.79Zm13.78 7.29H64v14.56h-6.89Zm20.67-7.29v29.14h13.78V53.07h6.89v21.86h6.89V53.07h6.89v21.86h6.89V45.79Z"
      fill="#cb3837"
    />
  </svg>
);

const ClaudeAIIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    height="1em"
    preserveAspectRatio="xMidYMid"
    viewBox="0 0 256 257"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="m50.228 170.321 50.357-28.257.843-2.463-.843-1.361h-2.462l-8.426-.518-28.775-.778-24.952-1.037-24.175-1.296-6.092-1.297L0 125.796l.583-3.759 5.12-3.434 7.324.648 16.202 1.101 24.304 1.685 17.629 1.037 26.118 2.722h4.148l.583-1.685-1.426-1.037-1.101-1.037-25.147-17.045-27.22-18.017-14.258-10.37-7.713-5.25-3.888-4.925-1.685-10.758 7-7.713 9.397.649 2.398.648 9.527 7.323 20.35 15.75L94.817 91.9l3.889 3.24 1.555-1.102.195-.777-1.75-2.917-14.453-26.118-15.425-26.572-6.87-11.018-1.814-6.61c-.648-2.723-1.102-4.991-1.102-7.778l7-10.823L71.42 0 82.05 1.426l4.472 3.888 6.61 15.101 10.694 23.786 16.591 32.34 4.861 9.592 2.592 8.879.973 2.722h1.685v-1.556l1.36-18.211 2.528-22.36 2.463-28.776.843-8.1 4.018-9.722 7.971-5.25 6.222 2.981 5.12 7.324-.713 4.73-3.046 19.768-5.962 30.98-3.889 20.739h2.268l2.593-2.593 10.499-13.934 17.628-22.036 7.778-8.749 9.073-9.657 5.833-4.601h11.018l8.1 12.055-3.628 12.443-11.342 14.388-9.398 12.184-13.48 18.147-8.426 14.518.778 1.166 2.01-.194 30.46-6.481 16.462-2.982 19.637-3.37 8.88 4.148.971 4.213-3.5 8.62-20.998 5.184-24.628 4.926-36.682 8.685-.454.324.519.648 16.526 1.555 7.065.389h17.304l32.21 2.398 8.426 5.574 5.055 6.805-.843 5.184-12.962 6.611-17.498-4.148-40.83-9.721-14-3.5h-1.944v1.167l11.666 11.406 21.387 19.314 26.767 24.887 1.36 6.157-3.434 4.86-3.63-.518-23.526-17.693-9.073-7.972-20.545-17.304h-1.36v1.814l4.73 6.935 25.017 37.59 1.296 11.536-1.814 3.76-6.481 2.268-7.13-1.297-14.647-20.544-15.1-23.138-12.185-20.739-1.49.843-7.194 77.448-3.37 3.953-7.778 2.981-6.48-4.925-3.436-7.972 3.435-15.749 4.148-20.544 3.37-16.333 3.046-20.285 1.815-6.74-.13-.454-1.49.194-15.295 20.999-23.267 31.433-18.406 19.702-4.407 1.75-7.648-3.954.713-7.064 4.277-6.286 25.47-32.405 15.36-20.092 9.917-11.6-.065-1.686h-.583L44.07 198.125l-12.055 1.555-5.185-4.86.648-7.972 2.463-2.593 20.35-13.999-.064.065Z"
      fill="#D97757"
    />
  </svg>
);

function CopyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      color={"#000000"}
      fill={"none"}
      height={24}
      viewBox="0 0 24 24"
      width={24}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M9 15C9 12.1716 9 10.7574 9.87868 9.87868C10.7574 9 12.1716 9 15 9L16 9C18.8284 9 20.2426 9 21.1213 9.87868C22 10.7574 22 12.1716 22 15V16C22 18.8284 22 20.2426 21.1213 21.1213C20.2426 22 18.8284 22 16 22H15C12.1716 22 10.7574 22 9.87868 21.1213C9 20.2426 9 18.8284 9 16L9 15Z"
        fill="currentColor"
        opacity="0.4"
      />
      <path
        d="M9 15C9 12.1716 9 10.7574 9.87868 9.87868C10.7574 9 12.1716 9 15 9L16 9C18.8284 9 20.2426 9 21.1213 9.87868C22 10.7574 22 12.1716 22 15V16C22 18.8284 22 20.2426 21.1213 21.1213C20.2426 22 18.8284 22 16 22H15C12.1716 22 10.7574 22 9.87868 21.1213C9 20.2426 9 18.8284 9 16L9 15Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M16.9999 9C16.9975 6.04291 16.9528 4.51121 16.092 3.46243C15.9258 3.25989 15.7401 3.07418 15.5376 2.90796C14.4312 2 12.7875 2 9.5 2C6.21252 2 4.56878 2 3.46243 2.90796C3.07417 3.07417 3.25989 3.25989 3.46243 3.46243C2 4.56878 2 6.21252 2 9.5C2 12.7875 2 14.4312 2.90796 15.5376C3.07417 15.7401 3.25989 15.9258 3.46243 16.092C4.51121 16.9528 6.04291 16.9975 9 16.9999"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

const installMethods = [
  {
    id: "download",
    title: "Download",
    description: "Get the complete project as a ZIP file ready to use.",
    icon: VisualStudioCodeIcon,
    badge: "Instant",
    command: "project.zip",
    span: "col-span-1",
    visual: "download",
  },
  {
    id: "shadcn-tools",
    title: "Shadcn Registry",
    description:
      "Install using CLI or MCP for seamless integration and AI-powered development.",
    icon: ShadcnIcon,
    badge: "Recommended",
    command: "npx shadcn@latest add component-name",
    span: "col-span-1",
    visual: "shadcn-tools",
  },
  {
    id: "copy-paste",
    title: "Copy & Paste",
    description:
      "Manually copy the component code and integrate into your project.",
    icon: CopyIcon,
    badge: "Manual",
    command: "// Copy component code directly",
    span: "col-span-1",
    visual: "code",
  },
  {
    id: "open-v0",
    title: "Open in v0",
    description:
      "Edit and customize components directly in the v0 editor with live preview.",
    icon: V0Icon,
    badge: "Interactive",
    command: "v0.dev/edit/component-id",
    span: "col-span-2",
    visual: "v0",
  },
  {
    id: "join-for-life",
    title: "Join for Life",
    description:
      "Get lifetime access to premium components and exclusive updates.",
    icon: StripeIcon,
    badge: "Coming Soon",
    command: "// Premium membership features",
    span: "col-span-1",
    visual: "premium",
  },
];

export function useDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  return isDesktop;
}

export function AnimatedDownloadFlow({
  isDesktop = false,
}: {
  isDesktop?: boolean;
}) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPreviewHover, setIsPreviewHover] = useState(false);
  const [hasAutoStarted] = useState(false);
  const controls = useAnimation();

  const startAnimation = async () => {
    setIsAnimating(true);
    setIsHovered(true);
    setIsPreviewHover(true);

    await controls.start({
      opacity: 0,
      scale: 0.8,
      transition: { duration: 0 },
    });

    await controls.start({
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.3,
        staggerChildren: 0.15,
        delayChildren: 0.05,
      },
    });

    setTimeout(() => {
      setTimeout(() => setIsAnimating(false), 1000);
    }, 1200);
  };

  useEffect(() => {
    if (!(isDesktop || hasAutoStarted)) {
      const timer = setTimeout(() => {
        startAnimation();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isDesktop, hasAutoStarted]);

  const handleMouseEnter = () => {
    if (isDesktop) {
      setIsHovered(true);
      if (!isAnimating) {
        startAnimation();
      }
    }
  };

  const handleMouseLeave = () => {
    if (isDesktop) {
      setIsHovered(false);
    }
  };

  return (
    <div className="relative h-full w-full">
      <div
        className="group relative flex h-full w-full cursor-pointer items-center justify-center"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-2 px-4">
          <div
            className="relative shrink-0"
            onMouseEnter={() => setIsPreviewHover(true)}
            onMouseLeave={() => setIsPreviewHover(false)}
          >
            <motion.div
              animate={
                isHovered
                  ? {}
                  : {
                      boxShadow: [
                        "0 0 0px rgba(59, 130, 246, 0)",
                        "0 0 8px rgba(59, 130, 246, 0.1)",
                        "0 0 0px rgba(59, 130, 246, 0)",
                      ],
                    }
              }
              className="-m-2 absolute inset-0 rounded-lg"
              transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY }}
            />

            <div className="relative">
              {/* Back file - JSON */}
              <motion.div
                animate={
                  isPreviewHover && !isHovered ? { scale: 1.01, y: -1 } : {}
                }
                className="absolute top-1 left-1 z-10 h-10 w-8 rounded border bg-base-100/30 shadow-[0px_1px_0px_0px_hsla(0,0%,0%,0.02)_inset,0px_0px_0px_1px_hsla(0,0%,0%,0.02)_inset,0px_0px_0px_1px_rgba(255,255,255,0.25)]"
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                whileHover={{ scale: 1.02, rotate: -1 }}
              >
                <div className="absolute top-0 right-0 h-2 w-2 rounded-bl bg-base-100/40" />
                <div className="space-y-0.5 p-1">
                  <motion.div
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    className="h-0.5 w-full rounded bg-cyan-500/60"
                    transition={{
                      duration: 2.5,
                      repeat: Number.POSITIVE_INFINITY,
                      delay: 0.3,
                    }}
                  />
                  <div className="h-0.5 w-5/6 rounded bg-base-100-foreground/30" />
                  <motion.div
                    animate={{ opacity: [0.4, 0.8, 0.4] }}
                    className="h-0.5 w-2/3 rounded bg-cyan-400/40"
                    transition={{
                      duration: 2.5,
                      repeat: Number.POSITIVE_INFINITY,
                      delay: 0.8,
                    }}
                  />
                </div>
              </motion.div>

              {/* Middle file - CSS */}
              <motion.div
                animate={
                  isPreviewHover && !isHovered ? { scale: 1.02, y: -0.5 } : {}
                }
                className="absolute top-0.5 left-0.5 z-20 h-10 w-8 rounded border bg-base-100/50 shadow-[0px_1px_0px_0px_hsla(0,0%,0%,0.02)_inset,0px_0px_0px_1px_hsla(0,0%,0%,0.02)_inset,0px_0px_0px_1px_rgba(255,255,255,0.25)]"
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                whileHover={{ scale: 1.03, rotate: 1 }}
              >
                <div className="absolute top-0 right-0 h-2 w-2 rounded-bl bg-base-100/50" />
                <div className="space-y-0.5 p-1">
                  <motion.div
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    className="h-0.5 w-full rounded bg-orange-500/60"
                    transition={{
                      duration: 2,
                      repeat: Number.POSITIVE_INFINITY,
                      delay: 0.1,
                    }}
                  />
                  <div className="h-0.5 w-2/3 rounded bg-base-100-foreground/35" />
                  <motion.div
                    animate={{ opacity: [0.4, 0.8, 0.4] }}
                    className="h-0.5 w-1/2 rounded bg-orange-400/40"
                    transition={{
                      duration: 2,
                      repeat: Number.POSITIVE_INFINITY,
                      delay: 0.6,
                    }}
                  />
                </div>
                <div className="absolute right-0.5 bottom-0.5 font-medium text-[6px] text-orange-600">
                  CSS
                </div>
              </motion.div>

              {/* Front file - TSX */}
              <motion.div
                animate={
                  isPreviewHover && !isHovered ? { scale: 1.03, y: -1 } : {}
                }
                className="relative z-30 h-10 w-8 rounded border bg-white shadow-[0px_1px_0px_0px_hsla(0,0%,0%,0.02)_inset,0px_0px_0px_1px_hsla(0,0%,0%,0.02)_inset,0px_0px_0px_1px_rgba(255,255,255,0.25)]"
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                whileHover={{ scale: 1.05, rotate: -2 }}
              >
                <div className="absolute top-0 right-0 h-2 w-2 rounded-bl bg-base-100/60" />
                <div className="space-y-0.5 p-1">
                  <motion.div
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    className="h-0.5 w-full rounded bg-primary/60"
                    transition={{
                      duration: 2,
                      repeat: Number.POSITIVE_INFINITY,
                    }}
                  />
                  <div className="h-0.5 w-3/4 rounded bg-base-100-foreground/40" />
                  <motion.div
                    animate={{ opacity: [0.4, 0.8, 0.4] }}
                    className="h-0.5 w-1/2 rounded bg-primary/40"
                    transition={{
                      duration: 2,
                      repeat: Number.POSITIVE_INFINITY,
                      delay: 0.5,
                    }}
                  />
                </div>
                <div className="absolute right-0.5 bottom-0.5 font-medium text-[6px] text-primary-600">
                  TSX
                </div>
              </motion.div>
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            {!isHovered && (
              <>
                <motion.div
                  animate={{
                    opacity: 0.6,
                    transition: { delay: 0.5, duration: 1 },
                  }}
                  className="flex-shrink-0 opacity-20"
                  exit={{
                    opacity: 0,
                    scale: 0.8,
                    transition: { duration: 0.0, delay: 0 },
                  }}
                  initial={{ opacity: 0 }}
                  key="ghost-arrow-1"
                >
                  <div className="flex items-center">
                    <div className="h-px w-4 border-base-300/30 border-t border-dashed" />
                    <ArrowRight className="ml-1 h-3 w-3 text-base-600/30" />
                    <div className="ml-1 h-px w-4 border-base-300/30 border-t border-dashed" />
                  </div>
                </motion.div>

                <motion.div
                  animate={{
                    opacity: 0.75,
                    scale: 1,
                    y: 0,
                    transition: { delay: 0.7, duration: 1 },
                  }}
                  className="relative flex-shrink-0 opacity-15"
                  exit={{
                    opacity: 0,
                    scale: 0.8,
                    y: -10,
                    transition: { duration: 0.0, delay: 0 },
                  }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  key="ghost-zip"
                >
                  <div className="relative h-12 w-10 rounded border border-base-300/20 border-dashed bg-base-100/10">
                    <div className="absolute top-0 right-0 h-3 w-3 rounded-bl bg-base-100/20" />
                    <div className="space-y-1 p-2">
                      <div className="h-0.5 w-1/2 rounded-full bg-base-100-foreground/20" />
                      <div className="h-0.5 w-1/3 rounded-full bg-base-100-foreground/15" />
                      <div className="h-0.5 w-1/4 rounded-full bg-base-100-foreground/10" />
                    </div>
                    <div className="-translate-x-1/2 absolute bottom-1 left-1/2">
                      <span className="font-bold text-[10px] text-base-600/30">
                        ZIP
                      </span>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  animate={{
                    opacity: 0.6,
                    transition: { delay: 0.8, duration: 1 },
                  }}
                  className="flex-shrink-0 opacity-20"
                  exit={{
                    opacity: 0,
                    scale: 0.8,
                    transition: { duration: 0.0, delay: 0 },
                  }}
                  initial={{ opacity: 0 }}
                  key="ghost-arrow-2"
                >
                  <div className="flex items-center">
                    <div className="h-px w-4 border-base-300/30 border-t border-dashed" />
                    <ArrowRight className="ml-1 h-3 w-3 text-base-600/30" />
                    <div className="ml-1 h-px w-4 border-base-300/30 border-t border-dashed" />
                  </div>
                </motion.div>

                <motion.div
                  animate={{
                    opacity: 0.75,
                    scale: 1,
                    transition: { delay: 0.9, duration: 1 },
                  }}
                  className="relative flex-shrink-0 opacity-15"
                  exit={{
                    opacity: 0,
                    scale: 0.8,
                    rotate: -5,
                    transition: { duration: 0.0, delay: 0 },
                  }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  key="ghost-package"
                >
                  <div className="relative h-10 w-8 rounded border border-base-300/20 border-dashed bg-base-100/10">
                    <div className="absolute top-0 right-0 h-2 w-2 rounded-bl bg-base-100/20" />
                    <div className="space-y-0.5 p-1">
                      <div className="h-0.5 w-full rounded bg-base-100-foreground/20" />
                      <div className="h-0.5 w-3/4 rounded bg-base-100-foreground/15" />
                      <div className="h-0.5 w-1/2 rounded bg-base-100-foreground/10" />
                    </div>
                    <div className="absolute right-0.5 bottom-0.5 font-semibold text-[6px] text-base-600/30">
                      PKG
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isHovered && (
              <>
                <motion.div
                  animate={{
                    opacity: 1,
                    x: 0,
                    transition: { duration: 0.3, delay: 0.1 },
                  }}
                  className="flex-shrink-0"
                  exit={{
                    opacity: 0,
                    x: 20,
                    scale: 0.9,
                    transition: { duration: 0.0 },
                  }}
                  initial={{ opacity: 0, x: -20 }}
                  key="active-arrow-1"
                >
                  <motion.div
                    animate={isHovered ? { x: [0, 3, 0] } : {}}
                    transition={{
                      duration: 0.8,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                    }}
                  >
                    <div className="flex items-center">
                      <div className="h-px w-4 border-base-300/50 border-t border-dashed" />
                      <ArrowRight className="ml-1 h-3 w-3 text-base-600" />
                      <div className="ml-1 h-px w-4 border-base-300/50 border-t border-dashed" />
                    </div>
                  </motion.div>
                </motion.div>

                <motion.div
                  animate={{
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    transition: { duration: 0.3, delay: 0.25 },
                  }}
                  className="relative shrink-0"
                  exit={{
                    opacity: 0,
                    scale: 0.7,
                    y: -20,
                    rotate: 10,
                    transition: { duration: 0.0 },
                  }}
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  key="active-zip"
                >
                  <motion.div
                    animate={isHovered ? { y: [0, -2, 0] } : {}}
                    className="relative"
                    transition={{
                      duration: 1.2,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                    }}
                    whileHover={{ scale: 1.05 }}
                  >
                    <div className="relative z-30 h-12 w-10 rounded-lg border border-base-200 bg-linear-to-br from-white to-muted/20">
                      <div className="absolute top-0 right-0 h-3 w-3 rounded-bl-lg bg-base-100/60" />

                      <div className="space-y-1 p-2">
                        <motion.div
                          animate={
                            isHovered
                              ? {
                                  width: ["20%", "80%", "20%"],
                                  opacity: [0.6, 1, 0.6],
                                }
                              : {}
                          }
                          className="h-0.5 rounded-full bg-[#FB2EFF]/60"
                          transition={{
                            duration: 1.5,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "easeInOut",
                          }}
                        />
                        <motion.div
                          animate={
                            isHovered
                              ? {
                                  width: ["10%", "60%", "10%"],
                                  opacity: [0.4, 0.8, 0.4],
                                }
                              : {}
                          }
                          className="h-0.5 rounded-full bg-[#FB2EFF]/40"
                          transition={{
                            duration: 1.5,
                            repeat: Number.POSITIVE_INFINITY,
                            delay: 0.3,
                            ease: "easeInOut",
                          }}
                        />
                        <motion.div
                          animate={
                            isHovered
                              ? {
                                  width: ["5%", "40%", "5%"],
                                  opacity: [0.3, 0.6, 0.3],
                                }
                              : {}
                          }
                          className="h-0.5 rounded-full bg-[#FB2EFF]/30"
                          transition={{
                            duration: 1.5,
                            repeat: Number.POSITIVE_INFINITY,
                            delay: 0.6,
                            ease: "easeInOut",
                          }}
                        />
                      </div>

                      <div className="-translate-x-1/2 absolute bottom-1 left-1/2">
                        <motion.span
                          animate={
                            isHovered
                              ? {
                                  textShadow: [
                                    "0 0 0px rgba(251, 46, 255, 0)",
                                    "0 0 8px rgba(251, 46, 255, 0.6)",
                                    "0 0 0px rgba(251, 46, 255, 0)",
                                  ],
                                }
                              : {}
                          }
                          className="font-bold text-[#FB2EFF] text-[10px]"
                          transition={{
                            duration: 1.2,
                            repeat: Number.POSITIVE_INFINITY,
                          }}
                        >
                          ZIP
                        </motion.span>
                      </div>
                    </div>

                    <motion.div
                      animate={{
                        borderColor: [
                          "rgba(251, 46, 255, 0.3)",
                          "rgba(251, 46, 255, 0.8)",
                          "rgba(192, 132, 252, 0.8)",
                          "rgba(251, 46, 255, 0.3)",
                        ],
                        boxShadow: [
                          "0px 1px 1px 0px rgba(0, 0, 0, 0.05), 0px 0px 0px 0px rgba(251, 46, 255, 0)",
                          "0px 1px 1px 0px rgba(0, 0, 0, 0.05), 0px 0px 12px 3px rgba(251, 46, 255, 0.3)",
                          "0px 1px 1px 0px rgba(0, 0, 0, 0.05), 0px 0px 0px 0px rgba(251, 46, 255, 0)",
                        ],
                      }}
                      className="-top-4 -translate-x-1/2 absolute left-1/2 rounded-full border border-[#FB2EFF]/30 bg-linear-to-br from-white to-[#FB2EFF]/5 px-2 py-1 font-bold text-[7px] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.05),0px_1px_1px_0px_rgba(251,46,255,0.5)_inset,0px_0px_0px_1px_hsla(0,0%,100%,0.1)_inset,0px_0px_1px_0px_rgba(28,27,26,0.5)]"
                      transition={{
                        duration: 2,
                        repeat: Number.POSITIVE_INFINITY,
                      }}
                    >
                      <span className="text-[#FB2EFF]">COMPRESSING</span>
                    </motion.div>

                    <motion.div
                      animate={{ rotate: 360 }}
                      className="-bottom-4 -translate-x-1/2 absolute left-1/2"
                      transition={{
                        duration: 1.2,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "linear",
                      }}
                    >
                      <div className="h-3 w-3 rounded-full border-2 border-[#FB2EFF]/30 border-t-[#FB2EFF]" />
                    </motion.div>
                  </motion.div>
                </motion.div>

                <motion.div
                  animate={{
                    opacity: 1,
                    x: 0,
                    transition: { duration: 0.3, delay: 0.4 },
                  }}
                  className="flex-shrink-0"
                  exit={{
                    opacity: 0,
                    x: 20,
                    scale: 0.9,
                    transition: { duration: 0.0 },
                  }}
                  initial={{ opacity: 0, x: -20 }}
                  key="active-arrow-2"
                >
                  <motion.div
                    animate={isHovered ? { x: [0, 3, 0] } : {}}
                    transition={{
                      duration: 0.8,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                      delay: 0.3,
                    }}
                  >
                    <div className="flex items-center">
                      <div className="h-px w-4 border-base-300/50 border-t border-dashed" />
                      <ArrowRight className="ml-1 h-3 w-3 text-base-600" />
                      <div className="ml-1 h-px w-4 border-base-300/50 border-t border-dashed" />
                    </div>
                  </motion.div>
                </motion.div>

                <motion.div
                  animate={{
                    opacity: 1,
                    scale: 1,
                    rotate: 0,
                    transition: {
                      duration: 0.4,
                      delay: 0.55,
                      type: "spring",
                      stiffness: 200,
                      damping: 15,
                    },
                  }}
                  className="relative shrink-0"
                  exit={{
                    opacity: 0,
                    scale: 0.3,
                    rotate: 15,
                    y: -30,
                    transition: { duration: 0.0 },
                  }}
                  initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                  key="active-package"
                >
                  <motion.div
                    animate={
                      isAnimating
                        ? {
                            y: [0, -2, 0],
                          }
                        : {}
                    }
                    className="relative"
                    transition={{
                      duration: 1.2,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                    }}
                    whileHover={{
                      scale: 1.05,
                      rotate: -2,
                      transition: {
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                      },
                    }}
                  >
                    <div className="relative z-30 h-10 w-8 rounded border bg-white shadow-[0px_1px_0px_0px_hsla(0,0%,0%,0.02)_inset,0px_0px_0px_1px_hsla(0,0%,100%,0.1)_inset,0px_0px_0px_1px_rgba(255,255,255,0.25)]">
                      <div className="absolute top-0 right-0 h-2 w-2 rounded-bl bg-emerald-100/80" />

                      <div className="space-y-0.5 p-1">
                        <motion.div
                          animate={
                            isHovered
                              ? {
                                  opacity: [0.7, 1, 0.7],
                                  width: ["100%", "90%", "100%"],
                                }
                              : {}
                          }
                          className="h-0.5 w-full rounded bg-emerald-500/70"
                          transition={{
                            duration: 1.5,
                            repeat: Number.POSITIVE_INFINITY,
                          }}
                        />
                        <div className="h-0.5 w-3/4 rounded bg-base-100-foreground/35" />
                        <motion.div
                          animate={
                            isHovered
                              ? {
                                  opacity: [0.5, 0.9, 0.5],
                                  width: ["50%", "60%", "50%"],
                                }
                              : {}
                          }
                          className="h-0.5 w-1/2 rounded bg-emerald-400/50"
                          transition={{
                            duration: 1.5,
                            repeat: Number.POSITIVE_INFINITY,
                            delay: 0.8,
                          }}
                        />
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center">
                        <motion.div
                          animate={
                            isHovered
                              ? {
                                  y: [0, -1, 0],
                                  opacity: [0.6, 0.9, 0.6],
                                }
                              : {}
                          }
                          className="flex flex-col items-center opacity-60"
                          transition={{
                            duration: 1.8,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "easeInOut",
                          }}
                        >
                          <div className="h-2.5 w-0.5 rounded-full bg-emerald-600/90" />
                          <div className="relative h-0.5 w-1.5 rounded-full bg-emerald-600/90">
                            <div className="-top-0.5 -translate-x-1/2 absolute left-1/2 h-0 w-0 border-transparent border-t-2 border-t-emerald-600/90 border-r-2 border-l-2" />
                          </div>
                        </motion.div>
                      </div>

                      <div className="absolute right-0.5 bottom-0.5 font-semibold text-[6px] text-emerald-700">
                        PKG
                      </div>
                    </div>

                    <motion.div
                      animate={
                        isHovered
                          ? {
                              y: [0, -1, 0],
                              opacity: [0.85, 1, 0.85],
                              boxShadow: [
                                "0 1px 2px rgba(0,0,0,0.05)",
                                "0 1px 3px rgba(16, 185, 129, 0.15), 0 1px 2px rgba(0,0,0,0.05)",
                                "0 1px 2px rgba(0,0,0,0.05)",
                              ],
                            }
                          : {}
                      }
                      className="-top-3.5 -translate-x-1/2 absolute left-1/2 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2 py-0.5 font-medium text-[7px] text-emerald-800 shadow-sm"
                      transition={{
                        duration: 1.5,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                      }}
                    >
                      READY
                    </motion.div>
                  </motion.div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {!isHovered && (
            <motion.div
              animate={{
                opacity: 1,
                transition: { delay: 0.4, duration: 0.3 },
              }}
              className="hidden lg:block"
              exit={{ opacity: 0, transition: { duration: 0.0 } }}
              initial={{ opacity: 0 }}
            >
              <motion.div
                animate={{
                  y: [0, -2, 0],
                  opacity: [0.7, 1, 0.7],
                  transition: {
                    duration: 2,
                    repeat: Number.POSITIVE_INFINITY,
                  },
                }}
                className="-bottom-8 -translate-x-1/2 absolute left-1/2 text-center"
                exit={{
                  opacity: 0,
                  y: 20,
                  scale: 0.9,
                  transition: { duration: 0.0 },
                }}
                initial={{ opacity: 0, y: 10 }}
                key="hint-text"
              >
                <div className="flex items-center gap-1 rounded-full border border-base-300/20 bg-base-100/30 px-3 py-1 backdrop-blur-sm">
                  <motion.div
                    animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.6, 1, 0.6] }}
                    className="h-1 w-1 rounded-full bg-primary/60"
                    transition={{
                      duration: 1.5,
                      repeat: Number.POSITIVE_INFINITY,
                    }}
                  />
                  <span className="font-medium text-[9px] text-base-600">
                    Hover to process files
                  </span>
                  <motion.div
                    animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.6, 1, 0.6] }}
                    className="h-1 w-1 rounded-full bg-primary/60"
                    transition={{
                      duration: 1.5,
                      repeat: Number.POSITIVE_INFINITY,
                      delay: 0.75,
                    }}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isHovered && (
            <motion.div
              animate={{
                opacity: 1,
                y: 10,
                transition: {
                  delay: 0.1,
                  type: "spring",
                  duration: 0.2,
                  mass: 0.1,
                },
              }}
              className="-bottom-4 -translate-x-1/2 absolute left-10 hidden text-center lg:block"
              exit={{
                opacity: 0,
                y: -10,
                scale: 0.9,
                transition: { duration: 0.0 },
              }}
              initial={{ opacity: 0, y: 0 }}
              key="status-text"
            >
              <motion.div className="text-[8px] text-base-600">
                {"Downloading...".split("").map((char, index) => (
                  <motion.span
                    animate={
                      isHovered
                        ? {
                            y: [0, -2, 0],
                            color: [
                              "hsl(var(--muted-foreground))",
                              "hsl(var(--primary))",
                              "hsl(var(--muted-foreground))",
                            ],
                          }
                        : {}
                    }
                    className="inline-block"
                    key={index}
                    transition={{
                      duration: 0.4,
                      delay: index * 0.05,
                      repeat: Number.POSITIVE_INFINITY,
                      repeatDelay: 1.2,
                    }}
                  >
                    {char === " " ? "\u00A0" : char}
                  </motion.span>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const renderVisual = (
  method: (typeof installMethods)[0],
  isDesktop: boolean
) => {
  switch (method.visual) {
    case "download":
      return <AnimatedDownloadFlow isDesktop={isDesktop} />;
    case "shadcn-tools":
      return (
        <div className="flex items-center justify-center">
          <div className="relative w-full max-w-[250px]">
            <div className="relative z-10 p-3">
              <div className="relative flex items-center justify-between gap-1.5">
                <div className="group relative flex-1">
                  <div className="-rotate-5 group-hover:-rotate-12 h-14 w-full rounded-lg border border-base-200 p-2 shadow-md transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg">
                    <div className="flex h-full flex-col items-center gap-1">
                      <div className="rounded-md bg-linear-to-br from-neutral-100 to-neutral-200 p-1.5 shadow-sm">
                        <NPMIcon className="size-4 text-white" />
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-[10px] text-base-900">
                          CLI
                        </div>
                      </div>
                    </div>
                  </div>
                  <motion.div
                    animate={{
                      y: [0, -4, 0],
                      scale: [1, 1.05, 1],
                    }}
                    className="-top-0.5 -right-0.5 absolute rounded bg-linear-to-r from-neutral-900 to-neutral-950 px-1.5 py-0.5 font-medium text-[8px] text-white shadow-md"
                    transition={{
                      duration: 0.6,
                      repeat: Number.POSITIVE_INFINITY,
                      repeatDelay: 2,
                      delay: 0.1,
                      ease: "easeInOut",
                    }}
                    whileHover={{
                      y: [0, -6, 0],
                      scale: [1, 1.1, 1],
                      transition: {
                        duration: 0.4,
                        repeat: Number.POSITIVE_INFINITY,
                        repeatDelay: 0.5,
                        ease: "easeInOut",
                      },
                    }}
                  >
                    Fast
                  </motion.div>
                </div>

                <div className="flex flex-col items-center justify-center">
                  <div className="h-0.5 w-4 bg-linear-to-r from-neutral-500 via-neutral-300 to-neutral-300" />
                  <div className="mt-0.5 h-0 w-0 border-transparent border-t-3 border-t-purple-300 border-r-1.5 border-l-1.5" />
                </div>

                <div className="group relative z-20 flex-1">
                  <div className="group-hover:-translate-y-0.5 h-14 w-full rounded-lg border border-base-200 p-2 shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl">
                    <div className="flex h-full flex-col items-center gap-1">
                      <div className="rounded-md bg-linear-to-br from-neutral-100 to-neutral-200 p-1.5 shadow-sm">
                        <ClaudeAIIcon className="size-4 text-white" />
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-[10px] text-base-900">
                          MCP
                        </div>
                      </div>
                    </div>
                  </div>
                  <motion.div
                    animate={{
                      y: [0, -4, 0],
                      scale: [1, 1.05, 1],
                      opacity: [0.8, 1, 0.8],
                    }}
                    className="-top-0.5 -right-0.5 absolute rounded bg-gradient-to-r from-neutral-900 to-neutral-950 px-1.5 py-0.5 font-medium text-[8px] text-white"
                    transition={{
                      duration: 0.6,
                      repeat: Number.POSITIVE_INFINITY,
                      repeatDelay: 2,
                      delay: 0.2,
                      ease: "easeInOut",
                    }}
                    whileHover={{
                      y: [0, -6, 0],
                      scale: [1, 1.1, 1],
                      opacity: [0.9, 1, 0.9],
                      transition: {
                        duration: 0.4,
                        repeat: Number.POSITIVE_INFINITY,
                        repeatDelay: 0.5,
                        ease: "easeInOut",
                      },
                    }}
                  >
                    AI
                  </motion.div>
                </div>

                <div className="flex flex-col items-center justify-center">
                  <div className="h-0.5 w-4 bg-linear-to-r from-neutral-300 via-neutral-300 to-neutral-500" />
                  <div className="mt-0.5 h-0 w-0 border-transparent border-t-3 border-t-emerald-500 border-r-1.5 border-l-1.5" />
                </div>

                <div className="group relative flex-1">
                  <div className="h-14 w-full rotate-5 rounded-lg border border-base-200 bg-linear-to-br p-2 shadow-md transition-all duration-300 group-hover:rotate-12 group-hover:scale-105 group-hover:shadow-lg">
                    <div className="flex h-full flex-col items-center gap-1">
                      <div className="rounded-md bg-linear-to-br from-neutral-500 to-neutral-600 shadow-sm">
                        <ShadcnIcon className="size-7 rounded-md text-white" />
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-[10px] text-base-900">
                          UI
                        </div>
                      </div>
                    </div>
                  </div>
                  <motion.div
                    animate={{
                      y: [0, -4, 0],
                      scale: [1, 1.05, 1],
                    }}
                    className="-top-0.5 -right-0.5 absolute rounded bg-linear-to-r from-neutral-900 to-neutral-950 px-1.5 py-0.5 font-medium text-[8px] text-white shadow-md"
                    transition={{
                      duration: 0.6,
                      repeat: Number.POSITIVE_INFINITY,
                      repeatDelay: 2,
                      delay: 0.3,
                      ease: "easeInOut",
                    }}
                    whileHover={{
                      y: [0, -6, 0],
                      scale: [1, 1.1, 1],
                      transition: {
                        duration: 0.4,
                        repeat: Number.POSITIVE_INFINITY,
                        repeatDelay: 0.5,
                        ease: "easeInOut",
                      },
                    }}
                  >
                    Ready
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    case "code":
      return (
        <div className="group relative flex h-[145px] w-full flex-col overflow-hidden rounded-lg border border-black/10 bg-white shadow-xs transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-md">
          <div className="flex shrink-0 items-center justify-between border-neutral-100 border-b bg-base-100 px-2 py-1.5">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-red-400 group-hover:animate-pulse" />
              <div
                className="h-1.5 w-1.5 rounded-full bg-yellow-400 group-hover:animate-pulse"
                style={{ animationDelay: "0.1s" }}
              />
              <div
                className="h-1.5 w-1.5 rounded-full bg-green-400 group-hover:animate-pulse"
                style={{ animationDelay: "0.2s" }}
              />
            </div>
            <div className="font-mono text-[10px] text-base-600 transition-colors group-hover:text-primary-600">
              component.tsx
            </div>
            <div className="flex h-5 w-5 cursor-pointer items-center justify-center rounded border transition-all duration-200 hover:bg-neutral-100 group-hover:scale-110 group-hover:border-blue-300">
              <Copy className="h-2.5 w-2.5 text-base-600 transition-colors group-hover:hidden group-hover:text-blue-500" />
              <CheckCheck className="hidden h-2.5 w-2.5 text-base-600 transition-colors group-hover:block group-hover:text-blue-500" />
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-center space-y-1.5 p-2">
            <div className="flex items-center gap-1.5 whitespace-nowrap font-mono text-[9px] transition-transform duration-300 group-hover:translate-x-1">
              <span className="text-blue-600 transition-colors group-hover:text-blue-700">
                import
              </span>
              <span className="text-neutral-900 transition-colors group-hover:text-neutral-800">
                {"{ Button }"}
              </span>
              <span className="text-blue-600 transition-colors group-hover:text-blue-700">
                from
              </span>
              <span className="text-green-600 transition-colors group-hover:text-green-700">
                "@/components/ui/button"
              </span>
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap font-mono text-[9px] transition-transform duration-300 group-hover:translate-x-1">
              <span className="text-blue-600 transition-colors group-hover:text-blue-700">
                import
              </span>
              <span className="text-neutral-900 transition-colors group-hover:text-neutral-800">
                {"{ useState }"}
              </span>
              <span className="text-blue-600 transition-colors group-hover:text-blue-700">
                from
              </span>
              <span className="text-green-600 transition-colors group-hover:text-green-700">
                "react"
              </span>
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap font-mono text-[9px] transition-transform duration-300 group-hover:translate-x-1">
              <span className="text-purple-600 transition-colors group-hover:text-purple-700">
                export
              </span>
              <span className="text-blue-600 transition-colors group-hover:text-blue-700">
                default
              </span>
              <span className="text-neutral-900 transition-colors group-hover:text-neutral-800">
                function
              </span>
              <span className="text-orange-600 transition-colors group-hover:text-orange-700">
                Component
              </span>
              <span className="text-neutral-900 transition-colors group-hover:text-neutral-800">
                ()
              </span>
              <span className="text-neutral-900 transition-colors group-hover:text-neutral-800">
                {"{"}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between border-neutral-100 border-t bg-neutral-50 px-2 py-1.5">
            <div className="flex items-center gap-1.5">
              <div className="h-1 w-1 rounded-full bg-green-500 group-hover:animate-pulse" />
              <span className="text-[10px] text-neutral-500 transition-colors group-hover:text-neutral-700">
                Ready
              </span>
            </div>
            <div className="text-[10px] text-neutral-400 transition-colors group-hover:text-neutral-600">
              10 lines
            </div>
          </div>
        </div>
      );
    case "v0":
      return (
        <div className="relative h-[240px] w-full overflow-hidden rounded-2xl border border-base-200">
          <img
            alt="v0 interface"
            className="h-28 w-full rounded-2xl object-cover lg:h-full"
            src="/vo-screen-2.png"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              target.style.display = "none";
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) {
                fallback.style.display = "flex";
              }
            }}
          />
          <div className="hidden h-full w-full flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white p-4 shadow-lg">
            <V0Icon className="mb-2 h-8 w-8 text-neutral-400" />
            <h3 className="mb-1 font-semibold text-neutral-900 text-sm">
              Open in v0
            </h3>
            <p className="text-center text-neutral-600 text-xs">
              Edit and customize components directly in the v0 editor
            </p>
          </div>
        </div>
      );
    case "premium":
      return (
        <div className="flex items-center justify-center">
          <div className="relative w-full p-2">
            <div className="flex h-full flex-col rounded-lg bg-linear-to-br from-neutral-800 via-neutral-900 to-neutral-800 p-4 text-white">
              <header className="mb-3">
                <h3 className="mb-1 font-semibold text-[#EC06FF] text-sm">
                  LIFETIME LICENSE
                </h3>
                <p className="text-neutral-200 text-xs">
                  One-time payment, lifetime access
                </p>
              </header>

              <div className="mb-4 flex-1 space-y-3">
                <div className="flex items-baseline gap-2">
                  <div className="font-bold text-2xl text-white">$179</div>
                  <div className="text-lg text-neutral-400 line-through">
                    $279
                  </div>
                  <div className="rounded-full bg-[#FE64FF] px-2 py-0.5 text-white text-xs">
                    Save $100
                  </div>
                </div>

                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2">
                    <div className="mt-0.5 h-3 w-3 shrink-0 text-[#EC06FF]">
                      <svg
                        className="h-full w-full"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          clipRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          fillRule="evenodd"
                        />
                      </svg>
                    </div>
                    <span className="text-neutral-200">
                      All current & future components
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="mt-0.5 h-3 w-3 shrink-0 text-[#EC06FF]">
                      <svg
                        className="h-full w-full"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          clipRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          fillRule="evenodd"
                        />
                      </svg>
                    </div>
                    <span className="text-neutral-200">
                      Commercial use included
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="mt-0.5 h-3 w-3 shrink-0 text-[#EC06FF]">
                      <svg
                        className="h-full w-full"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          clipRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          fillRule="evenodd"
                        />
                      </svg>
                    </div>
                    <span className="text-neutral-200">No renewal ever</span>
                  </li>
                </ul>

                <div className="mt-4">
                  <Button variant="default">Purchase</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
};

export function InstallBlockWidget() {
  const isDesktop = useDesktop();
  const filteredMethods = isDesktop
    ? installMethods
    : installMethods.filter((method) => method.id !== "copy-paste");

  return (
    <div className="mx-auto w-full max-w-5xl px-6">
      <div className="grid 3xl:grid-cols-6 grid-cols-1 gap-4 [--color-border:color-mix(in_oklab,var(--color-muted)10%,transparent)] md:grid-cols-2 xl:grid-cols-3">
        {filteredMethods.map((method, index) => {
          const Icon = method.icon;

          const getBentoSpan = (_span: string, cardIndex: number) => {
            if (cardIndex < 3) {
              return "xl:col-span-1 3xl:col-span-2";
            }
            if (cardIndex === 3) {
              return "xl:col-span-2 3xl:col-span-4";
            }
            return "xl:col-span-1 3xl:col-span-2";
          };

          return (
            <div
              className={cn(
                "h-[250px] border border-base-200 bg-white p-3 text-base-900 lg:h-[280px] lg:p-6",
                getBentoSpan(method.span, index),
                "group grid grid-rows-[auto_1fr] space-y-4 overflow-hidden rounded-2xl"
              )}
              data-slot="card"
              key={method.id}
            >
              {method.visual !== "premium" ? (
                <>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      {Icon && (
                        <div className="flex size-8 items-center justify-center rounded-lg bg-base-100/70 shadow-sm">
                          <Icon className="size-5 rounded-md p-px" />
                        </div>
                      )}
                    </div>

                    <TwoToneText
                      className="max-w-68"
                      primaryText={method.title}
                      primaryWeight="semi"
                      secondaryText={method.description}
                      secondaryWeight="base"
                      size="xs"
                    />
                  </div>

                  <div className="-m-6 relative flex items-center p-6">
                    <div className="relative w-full">
                      <div className="grid w-full gap-2 rounded-2xl p-3 text-xs duration-300 grid-cols-[auto_1fr]">
                        <div className="relative h-fit">
                          {renderVisual(method, isDesktop)}
                        </div>
                        <div className="mt-0.5" />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="-m-6 relative flex items-end">
                  <div className="relative w-full">
                    {renderVisual(method, isDesktop)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MarketingBento1() {
  return (
    <section className="py-12">
      <InstallBlockWidget />
    </section>
  );
}
