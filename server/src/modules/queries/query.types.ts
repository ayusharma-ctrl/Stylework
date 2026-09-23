import { Field,ID,InputType,Int,ObjectType,registerEnumType } from '@nestjs/graphql';
import { GraphQLScalarType,Kind } from 'graphql';
export const JsonScalar=new GraphQLScalarType({name:'JSON',description:'JSON metadata',serialize:value=>value,parseValue:value=>value,parseLiteral:node=>node.kind===Kind.NULL?null:undefined});
export enum Sort {CREATED_AT='CREATED_AT',UPDATED_AT='UPDATED_AT',NAME='NAME'}
export enum Direction {ASC='ASC',DESC='DESC'}
registerEnumType(Sort,{name:'LeadSort'});registerEnumType(Direction,{name:'SortDirection'});
@InputType()
export class PageInput {
 @Field(()=>Int,{nullable:true}) first?:number;
 @Field(()=>Int,{nullable:true}) last?:number;
 @Field({nullable:true}) after?:string;
 @Field({nullable:true}) before?:string;
 @Field({nullable:true}) search?:string;
 @Field(()=>Direction,{nullable:true}) direction?:Direction;
 @Field({nullable:true}) createdFrom?:string;
 @Field({nullable:true}) createdTo?:string;
}
@InputType()
export class LeadQueryInput extends PageInput {
 @Field(()=>Sort,{nullable:true}) sort?:Sort;
 @Field(()=>[ID],{nullable:true}) statusIds?:string[];
 @Field({nullable:true}) source?:string;
}
@InputType()
export class ActivityQueryInput extends PageInput {
 @Field(()=>ID,{nullable:true}) leadId?:string;
 @Field(()=>ID,{nullable:true}) actorId?:string;
 @Field(()=>[String],{nullable:true}) types?:string[];
}
@ObjectType()
export class PageInfoType {
 @Field({nullable:true}) startCursor?:string;
 @Field({nullable:true}) endCursor?:string;
 @Field() hasNextPage!:boolean;
 @Field() hasPreviousPage!:boolean;
}
@ObjectType()
export class StatusType {
 @Field(()=>ID) id!:string;
 @Field() name!:string;
 @Field() color!:string;
 @Field(()=>Int) position!:number;
 @Field({nullable:true}) archivedAt?:string;
 @Field(()=>Int) version!:number;
}
@ObjectType()
export class LeadType {
 @Field(()=>ID) id!:string;
 @Field() source!:string;
 @Field() externalId!:string;
 @Field(()=>Int) sourceVersion!:number;
 @Field() fullName!:string;
 @Field({nullable:true}) email?:string;
 @Field({nullable:true}) phone?:string;
 @Field({nullable:true}) company?:string;
 @Field({nullable:true}) campaign?:string;
 @Field(()=>JsonScalar,{complexity:20}) metadata!:Record<string,unknown>;
 @Field(()=>Int) version!:number;
 @Field() createdAt!:string;
 @Field() updatedAt!:string;
 @Field(()=>StatusType) status!:StatusType;
}
@ObjectType()
export class ActivityType {
 @Field(()=>ID) id!:string;
 @Field(()=>ID,{nullable:true}) leadId?:string;
 @Field(()=>ID) entityId!:string;
 @Field() entityType!:string;
 @Field() type!:string;
 @Field(()=>ID,{nullable:true}) actorId?:string;
 @Field(()=>JsonScalar) actor!:Record<string,unknown>;
 @Field() summary!:string;
 @Field(()=>JsonScalar,{nullable:true,complexity:5}) before?:Record<string,unknown>;
 @Field(()=>JsonScalar,{nullable:true,complexity:5}) after?:Record<string,unknown>;
 @Field() requestId!:string;
 @Field() createdAt!:string;
}
@ObjectType()
export class LeadConnection {
 @Field(()=>[LeadType]) nodes!:LeadType[];
 @Field(()=>PageInfoType) pageInfo!:PageInfoType;
}
@ObjectType()
export class ActivityConnection {
 @Field(()=>[ActivityType]) nodes!:ActivityType[];
 @Field(()=>PageInfoType) pageInfo!:PageInfoType;
}
