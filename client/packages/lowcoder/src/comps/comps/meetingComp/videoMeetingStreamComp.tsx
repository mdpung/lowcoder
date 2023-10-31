import { BoolCodeControl } from "comps/controls/codeControl";
import { dropdownControl } from "comps/controls/dropdownControl";
import { IconControl } from "comps/controls/iconControl";
import { CompNameContext, EditorContext, EditorState } from "comps/editorState";
import { withDefault } from "comps/generators";
import { UICompBuilder } from "comps/generators/uiCompBuilder";
import ReactResizeDetector from "react-resize-detector";
import _ from "lodash";
import {
  CommonBlueLabel,
  controlItem,
  Dropdown,
  Section,
  sectionNames,
} from "lowcoder-design";
import { trans } from "i18n";

import styled, { css } from "styled-components";
import {
  CommonNameConfig,
  NameConfig,
  withExposingConfigs,
} from "../../generators/withExposing";
import { IForm } from "../formComp/formDataConstants";
import { SimpleNameComp } from "../simpleNameComp";
import { ButtonStyleControl } from "./videobuttonCompConstants";
import { RefControl } from "comps/controls/refControl";
import { useEffect, useRef, useState } from "react";

import { AutoHeightControl } from "comps/controls/autoHeightControl";
import {
  VideoMeetingControllerComp,
  client,
} from "./videoMeetingControllerComp";

import { IAgoraRTCRemoteUser } from "agora-rtc-sdk-ng";

import {
  MeetingEventHandlerControl,
  StringStateControl,
  hiddenPropertyView,
  stringExposingStateControl,
} from "@lowcoder-ee/index.sdk";

const FormLabel = styled(CommonBlueLabel)`
  font-size: 13px;
  margin-right: 4px;
`;

function getFormOptions(editorState: EditorState) {
  return editorState
    .uiCompInfoList()
    .filter((info) => info.type === "form")
    .map((info) => ({
      label: info.name,
      value: info.name,
    }));
}
const Container = styled.div<{ $style: any }>`
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;
const TextContainer = styled.div<{ $style: any }>`
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  position: absolute;
  justify-content: center;
  ${(props) => props.$style && getStyle(props.$style)}
`;
const VideoContainer = styled.video<{ $style: any }>`
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  ${(props) => props.$style && getStyle(props.$style)}
`;

const getStyle = (style: any) => {
  return css`
     {
      border: 1px solid ${style.border};
      border-radius: ${style.radius};
      margin: ${style.margin};
      padding: ${style.padding};
      background-color: ${style.background};
    }
  `;
};
function getForm(editorState: EditorState, formName: string) {
  const comp = editorState?.getUICompByName(formName);
  if (comp && comp.children.compType.getView() === "form") {
    return comp.children.comp as unknown as IForm;
  }
}

function getFormEventHandlerPropertyView(
  editorState: EditorState,
  formName: string
) {
  const form = getForm(editorState, formName);
  if (!form) {
    return undefined;
  }

  return (
    <CompNameContext.Provider value={formName}>
      {form.onEventPropertyView(
        <>
          <FormLabel
            onClick={() =>
              editorState.setSelectedCompNames(
                new Set([formName]),
                "rightPanel"
              )
            }
          >
            {formName}
          </FormLabel>
          {trans("button.formButtonEvent")}
        </>
      )}
    </CompNameContext.Provider>
  );
}

class SelectFormControl extends SimpleNameComp {
  override getPropertyView() {
    const label = trans("button.formToSubmit");
    return controlItem(
      { filterText: label },
      <EditorContext.Consumer>
        {(editorState) => (
          <>
            <Dropdown
              label={label}
              value={this.value}
              options={getFormOptions(editorState)}
              onChange={(value) => this.dispatchChangeValueAction(value)}
              allowClear={true}
            />
            {getFormEventHandlerPropertyView(editorState, this.value)}
          </>
        )}
      </EditorContext.Consumer>
    );
  }
}

const typeOptions = [
  {
    label: trans("button.default"),
    value: "",
  },
  {
    label: trans("button.submit"),
    value: "submit",
  },
] as const;

export const meetingStreamChildren = {
  autoHeight: withDefault(AutoHeightControl, "fixed"),
  shareScreen: withDefault(BoolCodeControl, false),
  type: dropdownControl(typeOptions, ""),
  onEvent: MeetingEventHandlerControl,
  disabled: BoolCodeControl,
  loading: BoolCodeControl,
  form: SelectFormControl,
  prefixIcon: IconControl,
  suffixIcon: IconControl,
  style: ButtonStyleControl,
  viewRef: RefControl<HTMLElement>,
  userId: stringExposingStateControl(""),
  profileImageUrl: withDefault(
    StringStateControl,
    "https://via.placeholder.com/120"
  ),
  noVideoText: stringExposingStateControl("No Video"),
};

let VideoCompBuilder = (function (props) {
  return new UICompBuilder(meetingStreamChildren, (props) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const conRef = useRef<HTMLDivElement>(null);
    const placeholderRef = useRef<HTMLDivElement>(null);
    const [userId, setUserId] = useState();
    const [userName, setUsername] = useState("");
    const [showVideo, setVideo] = useState(true);

    useEffect(() => {
      onResize();
    }, []);

    const onResize = async () => {
      const container = conRef.current;
      let videoCo = videoRef.current;
      if (videoCo) {
        videoCo!.style.height = container?.clientHeight + "px";
        videoCo!.style.width = container?.clientWidth + "px";
      }
    };
    useEffect(() => {
      if (props.userId.value !== "") {
        let userData = JSON.parse(props.userId?.value);
        if (
          userData.user == userId &&
          userData.streamingVideo == false &&
          videoRef.current &&
          videoRef.current?.id == userId + ""
        ) {
          if (videoRef.current && videoRef.current?.id == userId + "") {
            videoRef.current.srcObject = null;
            setVideo(false);
          }
        } else {
          setVideo(true);
        }
        client.on(
          "user-published",
          async (user: IAgoraRTCRemoteUser, mediaType: "video" | "audio") => {
            if (mediaType === "video") {
              const remoteTrack = await client.subscribe(user, mediaType);
              let userId = user.uid + "";
              if (
                user.hasVideo &&
                user.uid + "" != userData.user &&
                userData.user != ""
              ) {
                props.onEvent("videoOn");
              }
              const element = document.getElementById(userId);

              if (element) {
                remoteTrack.play(userId);
              }
            }
            if (mediaType === "audio") {
              const remoteTrack = await client.subscribe(user, mediaType);
              if (
                user.hasAudio &&
                user.uid + "" != userData.user &&
                userData.user != ""
              ) {
                userData.audiostatus = user.hasVideo;

                props.onEvent("audioUnmuted");
              }
              remoteTrack.play();
            }
          }
        );
        client.on(
          "user-unpublished",
          (user: IAgoraRTCRemoteUser, mediaType: "video" | "audio") => {
            if (mediaType === "audio") {
              if (
                !user.hasAudio &&
                user.uid + "" != userData.user &&
                userData.user != ""
              ) {
                userData.audiostatus = user.hasVideo;
                props.onEvent("audioMuted");
              }
            }
            if (mediaType === "video") {
              if (videoRef.current && videoRef.current?.id == user.uid + "") {
                videoRef.current.srcObject = null;
              }
              if (
                !user.hasVideo &&
                user.uid + "" != userData.user &&
                userData.user != ""
              ) {
                props.onEvent("videoOff");
              }
            }
          }
        );

        setUserId(userData.user);
        setUsername(userData.userName);
      }
    }, [props.userId.value]);

    return (
      <EditorContext.Consumer>
        {(editorState) => (
          <ReactResizeDetector onResize={onResize}>
            <Container ref={conRef} $style={props.style}>
              {props.shareScreen || userId ? (
                <>
                  <VideoContainer
                    onClick={() => props.onEvent("videoClicked")}
                    ref={videoRef}
                    style={{ display: `${showVideo ? "flex" : "none"}` }}
                    $style={props.style}
                    id={props.shareScreen ? "share-screen" : userId}
                  ></VideoContainer>
                  <TextContainer
                    onClick={() => props.onEvent("videoClicked")}
                    ref={placeholderRef}
                    style={{
                      display: `${!showVideo ? "flex" : "none"}`,
                      flexDirection: "column",
                    }}
                    $style={props.style}
                  >
                    <img
                      style={{ borderRadius: "50%" }}
                      src={props.profileImageUrl.value}
                    />
                    {userName ?? "No Username"}
                  </TextContainer>
                </>
              ) : (
                // )
                <TextContainer $style={props.style}>
                  <p>No Video</p>
                </TextContainer>
              )}
            </Container>
          </ReactResizeDetector>
        )}
      </EditorContext.Consumer>
    );
  })
    .setPropertyViewFn((children) => (
      <>
        <Section name={sectionNames.basic}>
          {children.userId.propertyView({ label: trans("meeting.videoId") })}
          {children.profileImageUrl.propertyView({
            label: trans("meeting.profileImageUrl"),
            placeholder: "https://via.placeholder.com/120",
          })}
          {children.autoHeight.getPropertyView()}
          {children.shareScreen.propertyView({
            label: trans("meeting.shareScreen"),
          })}
        </Section>
        <Section name={sectionNames.interaction}>
          {children.onEvent.getPropertyView()}
        </Section>
        <Section name={sectionNames.layout}>
          {hiddenPropertyView(children)}
        </Section>
        <Section name={sectionNames.style}>
          {children.style.getPropertyView()}
        </Section>
      </>
    ))
    .build();
})();

VideoCompBuilder = class extends VideoCompBuilder {
  override autoHeight(): boolean {
    return this.children.autoHeight.getView();
  }
};

export const VideoMeetingStreamComp = withExposingConfigs(VideoCompBuilder, [
  new NameConfig("loading", trans("button.loadingDesc")),
  new NameConfig("profileImageUrl", trans("meeting.profileImageUrl")),

  ...CommonNameConfig,
]);
