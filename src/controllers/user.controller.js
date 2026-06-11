import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);

    console.log("1 User found");

    const accessToken = user.generateAccessToken();

    console.log("2 Access token generated");

    const refreshToken = user.generateRefreshToken();

    console.log("3 Refresh token generated");

    user.refreshToken = refreshToken;
    console.log("4. Refresh token assigned");

    await user.save({ validateBeforeSave: false });
    console.log("5. User saved");

    return { accessToken, refreshToken };
  } catch (error) {
    console.log(error);
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and accesss token",
    );
  }
};

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
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  //check for image
  //console.log(req.files)

  const avatarLocalPath = req.files?.avatar?.[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  //console.log(avatarLocalPath);

  // upload then to cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  // console.log(avatar)

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  // create use object to enter in db

  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  // remove password and refresh token feild
  const createUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  // cheack for user creation
  if (!createUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  // return response
  return res
    .status(201)
    .json(new ApiResponse(200, createUser, "user registered Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  //req body -> data
  // username or email
  // find the user
  // password cheack
  //access and refresh token
  // send cookie

  const { email, username, password } = req.body;

  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id,
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "user logged in successfully",
      ),
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    },
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, null, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(400, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(404, "invailde refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };
    const { accessToken, newRefreshToken } =
      awaitgenerateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed successfully",
        ),
      );
  } catch (error) {
    throw new ApiError(401, "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?.id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old Password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password change succe"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(200, req.user, "current user fetched succesfully");
});

const updateAccount = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new ApiError(400, "All feilds are required");
  }

  const user = User.findByIdAndUpdate(
    req.user?._id,
    { $set: { fullName: fullName, email: email } },
    { new: true },
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading an avatar");
  }

  const user = await User.findById(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true },
  ).select("-password");

  return res
  .status(200)
  .json(new ApiResponse(200,user, "Avatar updated successfully"))

});


const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "CoverImage file is missing");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading an CoverImage");
  }

  const user = await User.findById(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true },
  ).select("-password");

  return res
  .status(200)
  .json(new ApiResponse(200,user, "CoverImage updated successfully"))

});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccount,
  updateUserAvatar,
  updateUserCoverImage
};
