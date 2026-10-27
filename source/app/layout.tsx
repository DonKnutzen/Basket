import type {Metadata,Viewport} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Basket — Shop together.',description:'Shared shopping lists, receipts that remember, and a clear picture of your spending.',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:'Basket',statusBarStyle:'default'},icons:{icon:'/favicon.svg',apple:'/icon-192.png'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#285640'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
