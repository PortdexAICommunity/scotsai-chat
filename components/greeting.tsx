import { motion } from "framer-motion";

export const Greeting = () => {
	return (
		<div
			key="overview"
			className="max-w-none sm:max-w-3xl mx-auto mt-8 sm:mt-12 md:mt-20 px-4 sm:px-8 size-full flex flex-col justify-center"
		>
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: 10 }}
				transition={{ delay: 0.5 }}
				className="text-xl sm:text-3xl font-semibold"
			>
				Navigate Law with AI.
			</motion.div>
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: 10 }}
				transition={{ delay: 0.6 }}
				className="text-xl sm:text-2xl text-zinc-500"
			>
				&quot;Search, Automate, Connect&quot;
			</motion.div>
		</div>
	);
};
