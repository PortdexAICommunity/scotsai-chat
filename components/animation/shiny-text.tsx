"use client";
import { motion } from "framer-motion";

const AnimatedShinyText = ({ text }: { text: string }) => {
	return (
		<motion.div
			className="text-neutral-500/50 text-md font-semibold inline-block bg-gradient-to-r bg-clip-text from-45% via-50% to-60% from-transparent via-black/80 dark:via-white/80 to-transparent"
			animate={{ backgroundPosition: ["100%", "-100%"] }}
			transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
			style={{
				backgroundSize: "200% 100%",
			}}
		>
			{text}
		</motion.div>
	);
};

export default AnimatedShinyText;
