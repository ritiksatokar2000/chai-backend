import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  //TODO: get all videos based on query, sort, pagination
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  // TODO: get video, upload to cloudinary, create video
  if ([title, description].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const thumbnailPath = req.files?.thumbnail?.[0]?.path;

  const videoFilePath = req.files?.videoFile?.[0]?.path;

  if (!thumbnailPath) {
    throw new ApiError(400, "Thumbnail file is required");
  }

  if (!videoFilePath) {
    throw new ApiError(400, "Video file is required");
  }

  const thumbnail = await uploadOnCloudinary(thumbnailPath);
  const videoFile = await uploadOnCloudinary(videoFilePath);

  if (!thumbnail) {
    throw new ApiError(400, "thumbnail is not uploaded on cloudinary");
  }
  if (!videoFile) {
    throw new ApiError(400, "videoFile is not uploaded on cloudinary");
  }

  const video = await Video.create({
    title,
    description,
    thumbnail: thumbnail.url,
    videoFile: videoFile.url,
    duration: videoFile.duration,
    owner: req.user?._id,
    isPublish:true
  });

  if (!video) {
    throw new ApiError(500, "something went wrong while publishing video");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, video, "Video Pubish Successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id

  if (!videoId?.trim()) {
    throw new ApiError(400, "Video Id is missing");
  }

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid Video id");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  return res.status(200).json(new ApiResponse(200, video, "video found"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;
  //TODO: update video details like title, description, thumbnail

  if (!videoId) {
    throw new ApiError(400, "Video id not available");
  }

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "invaild Video id");
  }

  const existingVideo = await Video.findById(videoId);

  if (!existingVideo) {
    throw new ApiError(404, "Video not found");
  }

  // 3. Check ownership
  if (existingVideo.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this video");
  }

  const thumbnailPath = req.file?.path;

  if (!thumbnailPath) {
    throw new ApiError(400, "thumbnailPath is Missing");
  }

  const thumbnail = await uploadOnCloudinary(thumbnailPath);

  if (!thumbnail?.url) {
    throw new ApiError(400, "Error while uploading Thumbnail file ");
  }

  const video = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title: title,
        description: description,
        thumbnail: thumbnail.url,
      },
    },
    { new: true },
  );

  if (!video) {
    throw new ApiError(404, "Something went wrong");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video details Updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video
  if (!videoId) {
    throw new ApiError(400, "Video id not available");
  }

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "invaild Video id");
  }

  const existingVideo = await Video.findById(videoId);

  if (!existingVideo) {
    throw new ApiError(404, "Video not found");
  }

  if (existingVideo.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this video");
  }

  await Video.findByIdAndDelete(videoId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video Deleted Successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if(!videoId){
    throw new ApiError(400,"Video id not available")
  }

  if(!mongoose.Types.ObjectId.isValid(videoId)){
    throw new ApiError(400,"Invalid video id")
  }

  const existingVideo = await Video.findById(videoId)

  if(!existingVideo){
    throw new ApiError(404,"Video not found")
  }

  if(existingVideo.owner.toString() !== req.user._id.toString()){
    throw new ApiError(403, "You are not authorized to delete this video")
  }
  
  existingVideo.isPublish = !existingVideo.isPublish;

  await existingVideo.save();
  
  return res.status(200).json(new ApiResponse(200,existingVideo.isPublish,"status of publish status is change"))

});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
