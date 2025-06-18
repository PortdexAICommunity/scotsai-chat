"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Define the search result interface
interface SearchResult {
	id: string;
	title: string;
	url: string;
	publishedDate: string;
	author: string;
	text: string;
	image: string;
	favicon: string;
}

// Define the search response interface
interface SearchResponse {
	requestId: string;
	autopromptString: string;
	autoDate: string;
	resolvedSearchType: string;
	results: SearchResult[];
	costDollars: {
		total: number;
		search: {
			neural: number;
		};
		contents: {
			text: number;
		};
	};
}

// Define the wrapper interface for the incoming data
interface TextContent {
	type: "text";
	text: string;
}

// Simple loading spinner component
const LoadingSpinner = () => (
	<div className="animate-spin rounded-full size-4 border-b-2 border-current"></div>
);

export const FormatSearchResult = ({
	data,
}: {
	data: TextContent[] | SearchResponse | string;
}) => {
	// Show loading state if no data or empty data
	if (!data || (Array.isArray(data) && data.length === 0)) {
		return (
			<div className="flex items-center gap-2 text-muted-foreground py-4">
				<LoadingSpinner />
				<span>Searching...</span>
			</div>
		);
	}

	// Handle array format with text content
	if (Array.isArray(data) && data.length > 0 && data[0].type === "text") {
		// Check if the text content is empty or still loading
		if (!data[0].text || data[0].text.trim() === "") {
			return (
				<div className="flex items-center gap-2 text-muted-foreground py-4">
					<LoadingSpinner />
					<span>Searching...</span>
				</div>
			);
		}

		try {
			const parsedData: SearchResponse = JSON.parse(data[0].text);

			// Check if results are empty or still loading
			if (!parsedData.results || parsedData.results.length === 0) {
				return (
					<div className="flex items-center gap-2 text-muted-foreground py-4">
						<LoadingSpinner />
						<span>Searching...</span>
					</div>
				);
			}

			return (
				<div className="space-y-4 w-full search-results-container">
					<div className="text-sm text-muted-foreground">
						Search query: &quot;{parsedData.autopromptString}&quot; -{" "}
						{parsedData.results.length} results found
					</div>
					<div className="w-full overflow-hidden hidden md:block">
						<SearchResults results={parsedData.results} displayMode="list" />
					</div>
					<div className="w-full overflow-hidden block md:hidden">
						<SearchResultMobile
							results={parsedData.results}
							displayMode="list"
						/>
					</div>
				</div>
			);
		} catch (error) {
			console.error("Failed to parse JSON from text content:", error);
			// Show loading state instead of error if the JSON is incomplete
			return (
				<div className="flex items-center gap-2 text-muted-foreground py-4">
					<LoadingSpinner />
					<span>Searching...</span>
				</div>
			);
		}
	}

	// Handle both string and SearchResponse data types (existing logic)
	if (typeof data === "string") {
		// If it's an empty string, show loading
		if (data.trim() === "") {
			return (
				<div className="flex items-center gap-2 text-muted-foreground py-4">
					<LoadingSpinner />
					<span>Searching...</span>
				</div>
			);
		}
		return <div className="flex gap-2">{data}</div>;
	}

	// Handle direct SearchResponse object
	if (typeof data === "object" && !Array.isArray(data) && "results" in data) {
		// Check if results are empty or still loading
		if (!data.results || data.results.length === 0) {
			return (
				<div className="flex items-center gap-2 text-muted-foreground py-4">
					<LoadingSpinner />
					<span>Searching...</span>
				</div>
			);
		}

		return (
			<div className="space-y-4 w-full search-results-container">
				<div className="text-sm text-muted-foreground">
					Search query: &quot;{data.autopromptString}&quot; -{" "}
					{data.results.length} results found
				</div>
				<div className="w-full overflow-hidden hidden md:block">
					<SearchResults results={data.results} displayMode="list" />
				</div>
				<div className="w-full overflow-hidden block md:hidden">
					<SearchResultMobile results={data.results} displayMode="list" />
				</div>
			</div>
		);
	}

	// Fallback - show loading instead of error message
	return (
		<div className="flex items-center gap-2 text-muted-foreground py-4">
			<LoadingSpinner />
			<span>Searching...</span>
		</div>
	);
};

export interface SearchResultsProps {
	results: SearchResult[];
	displayMode?: "grid" | "list";
}

export function SearchResults({
	results,
	displayMode = "grid",
}: SearchResultsProps) {
	// State to manage whether to display the results
	const [showAllResults, setShowAllResults] = useState(false);

	const handleViewMore = () => {
		setShowAllResults(true);
	};

	// Logic for grid mode - improved responsive logic
	const displayedGridResults = showAllResults ? results : results.slice(0, 6); // Show more results initially
	const additionalResultsCount = results.length > 6 ? results.length - 6 : 0; // Adjust for new limit
	const displayUrlName = (url: string) => {
		const hostname = new URL(url).hostname;
		const parts = hostname.split(".");
		return parts.length > 2 ? parts.slice(1, -1).join(".") : parts[0];
	};

	// --- List Mode Rendering ---
	if (displayMode === "list") {
		return (
			<div>
				<div className="flex flex-col gap-1.5 sm:gap-2 w-full">
					{results.map((result: SearchResult, index: number) => (
						<Link
							href={result.url}
							key={index}
							passHref
							target="_blank"
							className="block w-full"
						>
							<Card className="w-full hover:bg-muted/50 transition-colors rounded-lg border">
								<CardContent className="p-3 sm:p-4 flex items-start space-x-3 w-full">
									<Avatar className="size-4 sm:size-5 md:size-6 mt-0.5 sm:mt-1 shrink-0">
										<AvatarImage
											src={
												result.favicon ||
												`https://www.google.com/s2/favicons?domain=${
													new URL(result.url).hostname
												}`
											}
											alt={new URL(result.url).hostname}
										/>
										<AvatarFallback className="text-[10px] sm:text-xs">
											{new URL(result.url).hostname[0]}
										</AvatarFallback>
									</Avatar>
									<div className="flex-1 overflow-hidden space-y-1 min-w-0">
										<p className="text-xs sm:text-sm md:text-base font-medium line-clamp-2 leading-tight break-words overflow-hidden">
											{result.title || new URL(result.url).pathname}
										</p>
										<p className="text-[11px] sm:text-xs md:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-3 leading-tight break-words overflow-hidden">
											{result.text}
										</p>
										<div className="text-[10px] sm:text-xs text-muted-foreground/80 mt-1 break-all overflow-hidden">
											<span className="underline">
												{new URL(result.url).hostname}
											</span>{" "}
											• #{index + 1}
										</div>
									</div>
								</CardContent>
							</Card>
						</Link>
					))}
				</div>
			</div>
		);
	}

	// --- Grid Mode Rendering (Improved Responsive Design) ---
	return (
		<div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3">
			{displayedGridResults.map((result: SearchResult, index: number) => (
				<Link href={result.url} passHref target="_blank" key={index}>
					<Card className="h-full hover:bg-muted/50 transition-colors group">
						<CardContent className="p-2 sm:p-3 flex flex-col justify-between h-full min-h-[120px] sm:min-h-[140px]">
							<div className="flex-1">
								<p className="text-xs sm:text-sm line-clamp-3 sm:line-clamp-4 mb-2 group-hover:line-clamp-none group-hover:text-wrap">
									{result.title || result.text}
								</p>
							</div>
							<div className="mt-auto flex items-center space-x-2 pt-2 border-t border-transparent group-hover:border-border/20">
								<Avatar className="size-4 sm:size-5 shrink-0">
									<AvatarImage
										src={
											result.favicon ||
											`https://www.google.com/s2/favicons?domain=${
												new URL(result.url).hostname
											}`
										}
										alt={new URL(result.url).hostname}
									/>
									<AvatarFallback className="text-[10px] sm:text-xs">
										{new URL(result.url).hostname[0]}
									</AvatarFallback>
								</Avatar>
								<div className="text-[10px] sm:text-xs text-muted-foreground truncate flex-1 min-w-0">
									<span className="font-medium">
										{displayUrlName(result.url)}
									</span>
									<span className="opacity-60 ml-1">#{index + 1}</span>
								</div>
							</div>
						</CardContent>
					</Card>
				</Link>
			))}
			{!showAllResults && additionalResultsCount > 0 && (
				<Card className="h-full flex items-center justify-center min-h-[120px] sm:min-h-[140px] border-dashed">
					<CardContent className="p-2 sm:p-3 flex items-center justify-center h-full">
						<Button
							variant="ghost"
							size="sm"
							className="text-muted-foreground hover:text-foreground flex flex-col items-center gap-1 h-auto py-3"
							onClick={handleViewMore}
						>
							<span className="text-xs sm:text-sm font-medium">
								+{additionalResultsCount}
							</span>
							<span className="text-[10px] sm:text-xs opacity-70">
								View more
							</span>
						</Button>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

export function SearchResultMobile({
	results,
	displayMode = "grid",
}: SearchResultsProps) {
	const [showAllResults, setShowAllResults] = useState(false);
	const resultsToShow = showAllResults ? results : results.slice(0, 3);
	const additionalResultsCount = results.length - resultsToShow.length;

	const handleViewMore = () => {
		setShowAllResults(true);
	};

	return (
		<div className="flex items-center">
			{resultsToShow.map((result, index) => (
				<Link
					key={result.id}
					href={result.url}
					target="_blank"
					rel="noopener noreferrer"
					className="block h-full"
				>
					<Avatar className="size-8 sm:size-10">
						<AvatarImage
							src={
								result.favicon ||
								`https://www.google.com/s2/favicons?domain=${
									new URL(result.url).hostname
								}`
							}
							alt={new URL(result.url).hostname}
						/>
						<AvatarFallback className="text-xs">
							{new URL(result.url).hostname[0]}
						</AvatarFallback>
					</Avatar>
				</Link>
			))}
			{!showAllResults && additionalResultsCount > 0 && (
				<Button
					variant="ghost"
					size="sm"
					className="text-muted-foreground hover:text-foreground flex flex-col items-center gap-1 h-auto py-2"
					onClick={handleViewMore}
				>
					<span className="text-xs font-medium">+{additionalResultsCount}</span>
				</Button>
			)}
		</div>
	);
}
