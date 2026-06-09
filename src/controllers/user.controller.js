import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js"
import  {uploadOnCloudinary} from "../utils/Cloudinary.js"

const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;
  console.log("email", email);


  // Validation - not Empty
  if (
    [fullname, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All feilds are required");
  }
   

  // check if user already exists : username, email
  const existedUser = await User.findOne({
    $or:[{ username },{ email }]
  })

  if(existedUser){
    throw new ApiError(409,"User with email or username already exists")
  }

  //check for image
  //console.log(req.files)

 const avatarLocalPath = req.files?.avatar?.[0]?.path;
 
 let coverImageLocalPath;
 if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
  coverImageLocalPath = req.files.coverImage[0].path
 }



 if(!avatarLocalPath){
  throw new ApiError(400,"Avatar file is required")
 }

 //console.log(avatarLocalPath);

 // upload then to cloudinary
 const avatar=await uploadOnCloudinary(avatarLocalPath);
 const coverImage = await uploadOnCloudinary(coverImageLocalPath);

 // console.log(avatar)

 if(!avatar){
  throw new ApiError(400,"Avatar file is required")
 }

 // create use object to enter in db

 const user = await User.create({
  fullname,
  avatar:avatar.url,
  coverImage: coverImage?.url || "",
  email,
  password,
  username:username.toLowerCase()
 })
 
 // remove password and refresh token feild
 const createUser = await User.findById(user._id).select("-password -refreshToken")

 // cheack for user creation
 if(!createUser){
  throw new ApiError(500,"Something went wrong while registering the user")
 }

 // return response 
 return res.status(201).json(
  new ApiResponse(200,createUser, "user registered Successfully")
 )

});

export { registerUser };
