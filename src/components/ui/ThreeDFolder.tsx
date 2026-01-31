import { useState, useRef, useEffect, useLayoutEffect, useCallback, forwardRef } from "react";

const PLACEHOLDER_IMG_URL = "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=800";

interface Project {
  id: string;
  image?: { src: string; srcSet?: string; alt?: string };
  title: string;
  link?: string;
}

interface AnimatedFolderProps {
  title?: string;
  projects?: Project[];
  folderBackColor?: string;
  folderFrontColor?: string;
  folderTabColor?: string;
  mainCardBackgroundColor?: string;
  mainCardBorderColor?: string;
  mainCardBorderWidth?: number;
  mainCardHoverBorderColor?: string;
  mainCardHoverBorderWidth?: number;
  projectCardBackgroundColor?: string;
  projectCardBorderColor?: string;
  projectCardBorderWidth?: number;
  projectCardHoverBorderColor?: string;
  projectCardHoverBorderWidth?: number;
  titleColor?: string;
  projectCountColor?: string;
  hoverExploreColor?: string;
  onClick?: () => void;
}

export default function AnimatedFolder({
  title = "Branding",
  projects = [],
  folderBackColor = "#aeff00ff",
  folderFrontColor = "#aeff00ff",
  folderTabColor = "#aeff00ff",
  mainCardBackgroundColor = "#ffffff",
  mainCardBorderColor = "#e5e7eb",
  mainCardBorderWidth = 1,
  mainCardHoverBorderColor = "#aeff00ff",
  mainCardHoverBorderWidth = 2,
  projectCardBackgroundColor = "#ffffff",
  projectCardBorderColor = "#e5e7eb",
  projectCardBorderWidth = 1,
  projectCardHoverBorderColor = "#aeff00ff",
  projectCardHoverBorderWidth = 2,
  titleColor = "#111827",
  projectCountColor = "#6b7280",
  hoverExploreColor = "#6b7280",
  onClick
}: AnimatedFolderProps) {
  const [mainHovered, setMainHovered] = useState(false);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // We only show up to 3 projects in the animation
  const displayProjects = projects.slice(0, 3);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
        borderRadius: "16px",
        cursor: "pointer",
        backgroundColor: mainCardBackgroundColor,
        border: `${mainHovered ? mainCardHoverBorderWidth : mainCardBorderWidth}px solid ${mainHovered ? mainCardHoverBorderColor : mainCardBorderColor}`,
        transition: "all 500ms ease-out",
        minWidth: "220px", // Reduced from 280 to fit better in grid
        minHeight: "280px", // Reduced from 320
        perspective: "1000px",
        boxShadow: mainHovered ? "0 25px 50px -12px rgba(163, 230, 53, 0.25)" : "none",
      }}
      onMouseEnter={() => setMainHovered(true)}
      onMouseLeave={() => setMainHovered(false)}
      onClick={onClick}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "16px",
          background: "radial-gradient(circle at 50% 70%, rgba(163, 230, 53, 0.08) 0%, transparent 70%)",
          opacity: mainHovered ? 1 : 0,
          transition: "opacity 500ms",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "16px",
          height: "160px",
          width: "200px",
        }}
      >
        {/* Back Folder Panel */}
        <div
          style={{
            position: "absolute",
            width: "128px",
            height: "96px",
            backgroundColor: folderBackColor,
            borderRadius: "8px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            transformOrigin: "bottom center",
            transform: mainHovered ? "rotateX(-15deg)" : "rotateX(0deg)",
            transition: "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            zIndex: 10,
          }}
        />
        {/* Folder Tab */}
        <div
          style={{
            position: "absolute",
            width: "48px",
            height: "16px",
            backgroundColor: folderTabColor,
            borderTopLeftRadius: "6px",
            borderTopRightRadius: "6px",
            top: "calc(50% - 48px - 12px)",
            left: "calc(50% - 64px + 16px)",
            transformOrigin: "bottom center",
            transform: mainHovered ? "rotateX(-25deg) translateY(-2px)" : "rotateX(0deg)",
            transition: "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            zIndex: 10,
          }}
        />
        
        {/* Project Cards Popping Out */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 20,
          }}
        >
          {displayProjects.map((project, index) => (
            <ProjectCard
              key={project.id}
              ref={(el) => (cardRefs.current[index] = el)}
              image={project.image}
              title={project.title}
              delay={index * 80}
              isVisible={mainHovered}
              index={index}
              cardBackgroundColor={projectCardBackgroundColor}
              cardBorderColor={projectCardBorderColor}
              cardBorderWidth={projectCardBorderWidth}
              cardHoverBorderColor={projectCardHoverBorderColor}
              cardHoverBorderWidth={projectCardHoverBorderWidth}
            />
          ))}
        </div>

        {/* Front Folder Panel */}
        <div
          style={{
            position: "absolute",
            width: "128px",
            height: "96px",
            backgroundColor: folderFrontColor,
            borderRadius: "8px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
            top: "calc(50% - 48px + 4px)",
            transformOrigin: "bottom center",
            transform: mainHovered ? "rotateX(25deg) translateY(8px)" : "rotateX(0deg)",
            transition: "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            zIndex: 30,
          }}
        />
        {/* Front Folder Gradient Overlay */}
        <div
          style={{
            position: "absolute",
            width: "128px",
            height: "96px",
            borderRadius: "8px",
            overflow: "hidden",
            pointerEvents: "none",
            top: "calc(50% - 48px + 4px)",
            background: "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%)",
            transformOrigin: "bottom center",
            transform: mainHovered ? "rotateX(25deg) translateY(8px)" : "rotateX(0deg)",
            transition: "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            zIndex: 31,
          }}
        />
      </div>

      <h3
        style={{
          fontSize: "18px",
          fontWeight: 600,
          color: titleColor,
          marginTop: "16px",
          transition: "all 300ms",
          transform: mainHovered ? "translateY(4px)" : "translateY(0)",
          textAlign: "center"
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: "14px",
          fontWeight: 400,
          color: projectCountColor,
          transition: "all 300ms",
          opacity: mainHovered ? 0.7 : 1,
          textAlign: "center"
        }}
      >
        {projects.length} files
      </p>
      <div
        style={{
          position: "absolute",
          bottom: "16px",
          left: "50%",
          transform: mainHovered ? "translate(-50%, 10px)" : "translate(-50%, 0)",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "12px",
          color: hoverExploreColor,
          transition: "all 300ms",
          opacity: mainHovered ? 0 : 0.6,
          width: "100%",
          justifyContent: "center"
        }}
      >
        <span>Click to open</span>
      </div>
    </div>
  );
}

const ProjectCard = forwardRef<
  HTMLDivElement,
  {
    image?: { src: string; srcSet?: string; alt?: string };
    title: string;
    delay: number;
    isVisible: boolean;
    index: number;
    cardBackgroundColor: string;
    cardBorderColor: string;
    cardBorderWidth: number;
    cardHoverBorderColor: string;
    cardHoverBorderWidth: number;
  }
>(
  (
    {
      image,
      title,
      delay,
      isVisible,
      index,
      cardBackgroundColor,
      cardBorderColor,
      cardBorderWidth,
      cardHoverBorderColor,
      cardHoverBorderWidth,
    },
    ref
  ) => {
    const rotations = [-12, 0, 12];
    const translations = [-55, 0, 55];
    const [cardHover, setCardHover] = useState(false);

    return (
      <div
        ref={ref}
        style={{
          position: "absolute",
          width: "80px",
          height: "112px",
          borderRadius: "8px",
          overflow: "hidden",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
          backgroundColor: cardBackgroundColor,
          border: `${cardHover ? cardHoverBorderWidth : cardBorderWidth}px solid ${cardHover ? cardHoverBorderColor : cardBorderColor}`,
          cursor: "pointer",
          transform: isVisible
            ? `translateY(-90px) translateX(${translations[index]}px) rotate(${rotations[index]}deg) scale(1)`
            : "translateY(0px) translateX(0px) rotate(0deg) scale(0.5)",
          opacity: isVisible ? 1 : 0,
          transition: `all 600ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`,
          zIndex: 10 - index,
          left: "-40px",
          top: "-56px",
        }}
        onMouseEnter={() => setCardHover(true)}
        onMouseLeave={() => setCardHover(false)}
      >
        <img
          src={image?.src || PLACEHOLDER_IMG_URL}
          srcSet={image?.srcSet}
          alt={image?.alt || title}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
          }}
        />
        <p
          style={{
            position: "absolute",
            bottom: "6px",
            left: "6px",
            right: "6px",
            fontSize: "10px",
            fontWeight: 500,
            color: "#ffffff",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </p>
      </div>
    );
  }
);
