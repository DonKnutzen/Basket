import type {BasketData} from './types';

export function householdSharing(data:Pick<BasketData,'user'|'members'>){
 const others=data.members.filter(member=>member.userId!==data.user.id);
 if(!others.length)return {shared:false,label:'Only you · Invite your partner'};
 const names=others.map(member=>member.displayName.trim()||'Household member');
 const label=names.length===1?names[0]:names.length===2?names.join(' and '):names.slice(0,2).join(', ')+` and ${names.length-2} more`;
 return {shared:true,label:'Shared with '+label};
}
