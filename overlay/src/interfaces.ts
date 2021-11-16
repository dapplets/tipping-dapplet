export interface ButtonCTXProps {
	authorFullname: string;
	authorImg: string;
	authorUsername: string;
	id: string;
	parent: null
	text: string;
	theme: string;
}

export interface ITipping {
	tweetId: string;
	nearId: string;
	count: number;
}

export interface ISendTipping {
	nearId: string;
	count: number;
}
