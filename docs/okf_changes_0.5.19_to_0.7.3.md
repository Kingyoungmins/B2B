# OKF diff — 0.5.19 → 0.7.3

- 함수 수: 1520 → 1901  (추가 381, 삭제 0, 변경 134)

## 추가된 함수
- `$id`  (assist-popup.js:15-15)
- `B2BHandler._hide_if_host_minimized`  (serve_b2b.py:1955-1965)
- `B2BHandler._reject_show_while_host_minimized`  (serve_b2b.py:2188-2194)
- `B2BHandler.handle_assist_attachment`  (serve_b2b.py:1658-1707)
- `B2BHandler.handle_diag_recent_trace`  (serve_b2b.py:2368-2412)
- `B2BHandler.handle_excel_preview_schema`  (serve_b2b.py:2338-2366)
- `B2BHandler.handle_excel_record_start`  (serve_b2b.py:2316-2322)
- `B2BHandler.handle_excel_record_status`  (serve_b2b.py:2331-2336)
- `B2BHandler.handle_excel_record_stop`  (serve_b2b.py:2324-2329)
- `B2BHandler.handle_excel_record_verify`  (serve_b2b.py:2414-2419)
- `B2BHandler.handle_excel_runner_mode`  (serve_b2b.py:2421-2430)
- `B2BHandler.handle_excel_verify_step`  (serve_b2b.py:2302-2313)
- `B2BHandler.handle_pipeline_live_final_snapshot`  (serve_b2b.py:2089-2108)
- `B2BHandler.handle_skill_consolidate`  (serve_b2b.py:2432-2440)
- `B2BHandler.handle_workbook_reinspect`  (serve_b2b.py:1709-1733)
- `ClickHiddenButton`  (NativeHost.cs:405-405)
- `EnsureAssistPopupAsync`  (NativeHost.cs:757-757)
- `ForceHostForeground`  (NativeHost.cs:995-995)
- `HandleAssistPopupCommand`  (NativeHost.cs:746-746)
- `HandleAssistWebMessage`  (NativeHost.cs:824-824)
- `NotifyMainAssist`  (NativeHost.cs:846-846)
- `PostHostMinimizedState`  (NativeHost.cs:1550-1550)
- `PythonComSkillContext._note_read_evidence`  (serve_b2b.py:11241-11251)
- `PythonComSkillContext._pivot_value_table`  (serve_b2b.py:11865-12016)
- `PythonComSkillContext.apply_filter`  (serve_b2b.py:11776-11818)
- `PythonComSkillContext.clear_filter`  (serve_b2b.py:11721-11755)
- `PythonComSkillContext.enable_filter`  (serve_b2b.py:11757-11774)
- `PythonComSkillContext.first_empty_col`  (serve_b2b.py:11089-11131)
- `PythonComSkillContext.match_fill`  (serve_b2b.py:13129-13448)
- `PythonComSkillContext.native_pivot`  (serve_b2b.py:12018-12153)
- `PythonComSkillContext.set_border`  (serve_b2b.py:11544-11596)
- `PythonComSkillContext.set_fill`  (serve_b2b.py:11503-11518)
- `PythonComSkillContext.set_font`  (serve_b2b.py:11520-11542)
- `RelayToAssistPopup`  (NativeHost.cs:855-855)
- `RotateLogAtStartup`  (NativeHost.cs:35-35)
- `_applyEditPrefill`  (pipeline.js:2738-2738)
- `_assistColLetter`  (assist-tools.js:95-95)
- `_assistColToIdx`  (assist-tools.js:484-484)
- `_assistDetectHeaderRow`  (assist-tools.js:68-68)
- `_assistErrorDiagnoseQuestion`  (pipeline.js:7094-7094)
- `_assistFileList`  (assist-tools.js:100-100)
- `_assistGateReplacementCode`  (assist-core.js:530-530)
- `_assistProposalCardBody`  (assist-ui.js:397-397)
- `_assistProposalPeek`  (assist-core.js:737-737)
- `_assistRefreshLiveFile`  (assist-tools.js:46-46)
- `_assistStepIndexById`  (assist-tools.js:82-82)
- `_assistStepLabel`  (assist-tools.js:92-92)
- `_assistSteps`  (assist-tools.js:38-38)
- `_buildLogicZipEntriesImpl`  (save-load.js:214-214)
- `_cfgNames`  (drop-handling.js:697-697)
- `_chunkLastActivateBook`  (pipeline.js:6710-6710)
- `_chunkNeedsClipboard`  (record-review.js:557-557)
- `_chunkPrimaryBook`  (pipeline.js:6698-6698)
- `_clarifySeparatorWhitespaceQuestion`  (chat-ui.js:3384-3384)
- `_cleanup_live_final_snapshots`  (serve_b2b.py:17757-17777)
- `_commit_pending_excel_cell_edit`  (serve_b2b.py:5036-5079)
- `_current_app_version`  (serve_b2b.py:226-270)
- `_demoteHeld`  (pipeline.js:2217-2217)
- `_diag`  (record-review.js:603-603)
- `_diffLiveSignatureParts`  (pipeline.js:3934-3934)
- `_editPrefillPromptOf`  (pipeline.js:2723-2723)
- `_enable_excel_context_menus`  (serve_b2b.py:3214-3227)
- `_estimateSubsteps`  (record-review.js:89-89)
- `_excel_grid_hwnds_for_pid`  (serve_b2b.py:5001-5033)
- `_exe_file_version`  (serve_b2b.py:199-223)
- `_extractPythonCode`  (record-review.js:190-190)
- `_extractVbaCode`  (record-review.js:173-173)
- `_extract_pptx_slide_texts`  (serve_b2b.py:1122-1139)
- `_fail`  (excel-mirror.js:711-711)
- `_find_live_final_snapshot`  (serve_b2b.py:17821-17833)
- `_finishBarrier`  (pipeline.js:4238-4238)
- `_handlePipelineStepToggleImpl`  (pipeline.js:3650-3650)
- `_install_ctx_kwarg_tolerance`  (serve_b2b.py:17323-17352)
- `_join_inflight_kills`  (serve_b2b.py:1019-1034)
- `_lazyFail`  (excel-mirror.js:2039-2039)
- `_live_final_snapshot_key`  (serve_b2b.py:17723-17734)
- `_live_final_snapshot_stats`  (serve_b2b.py:17737-17754)
- `_looks_like_date_number`  (serve_b2b.py:7880-7897)
- `_looks_like_hms`  (serve_b2b.py:7862-7868)
- `_looks_like_ymd`  (serve_b2b.py:7871-7877)
- `_mergeCallSignature`  (record-review.js:223-223)
- `_mergeTransformCode`  (record-review.js:96-96)
- `_mergeVbaChunkPair`  (record-review.js:565-565)
- `_mirror_unprotected_for_paste`  (serve_b2b.py:3389-3420)
- `_nonEmptyInCol`  (assist-tools.js:252-252)
- `_normalize_vba_llm_comment_slips`  (serve_b2b.py:7421-7437)
- `_normalize_version_text`  (serve_b2b.py:182-196)
- `_note_live_app_reset`  (serve_b2b.py:90-101)
- `_offStepsAmongSent`  (pipeline.js:3972-3972)
- `_parse_excel_color`  (serve_b2b.py:10784-10805)
- `_pickBestCol`  (assist-tools.js:253-253)
- `_pipelineCoreBusyReason`  (pipeline.js:4735-4735)
- `_pipelineSigHash`  (pipeline.js:137-137)
- `_promote_csv_multisheet_name`  (serve_b2b.py:10724-10739)
- `_protect_sheet_for_read_only_mirror`  (serve_b2b.py:3351-3385)
- `_pushAssistant`  (llm-api.js:278-278)
- `_py_skill_deadline`  (serve_b2b.py:10718-10721)
- `_reapplyVbaPipelineToLiveImpl`  (pipeline.js:4888-4888)
- `_reconcilePipelineSimulationAfterEditImpl`  (pipeline.js:5233-5233)
- `_recordStepsSummary`  (record-review.js:45-45)
- `_recordedAssignRhsMultiset`  (record-review.js:513-513)
- `_recordedIntentNeeded`  (record-review.js:506-506)
- `_recordedLike`  (pipeline.js:7004-7004)
- `_recordedMultisetContains`  (record-review.js:521-521)
- `_recordedWindowSheetPairs`  (record-review.js:534-534)
- `_recorded_vba_hazards`  (serve_b2b.py:6472-6502)
- `_recording_edit_unlock_active`  (serve_b2b.py:3187-3198)
- `_replaceStaleBookNamesInText`  (save-load.js:753-753)
- `_restore_excel_default_input`  (serve_b2b.py:3201-3211)
- `_runHeldStepsBatchImpl`  (pipeline.js:4536-4536)
- `_runPipelineSuffixFromCheckpointImpl`  (pipeline.js:4228-4228)
- `_save_live_final_snapshot`  (serve_b2b.py:17780-17818)
- `_set_display_prop_if_changed`  (serve_b2b.py:3456-3469)
- `_set_excel_ribbon_visible`  (serve_b2b.py:3230-3264)
- `_set_live_sessions_edit_unlock`  (serve_b2b.py:3267-3328)
- `_showBatchResumeChecklist`  (pipeline.js:4400-4400)
- `_signatureStepsAsRestored`  (pipeline.js:3884-3884)
- `_softRefreshRebuildFile`  (soft-refresh.js:106-106)
- `_softRefreshResolveInstantRestore`  (soft-refresh.js:128-128)
- `_stepsOnOffMap`  (pipeline.js:3960-3960)
- `_stripSynthesizedSheetSelects`  (record-review.js:578-578)
- `_syncPipelineToggleStatus`  (pipeline.js:3607-3607)
- `_throwIfAbandoned`  (pipeline.js:1159-1159)
- `_traceMap`  (drop-handling.js:1798-1798)
- `_unmaximize_hwnd_no_activate`  (serve_b2b.py:4026-4048)
- `_user_facing_workbook_name_for_live`  (serve_b2b.py:8074-8101)
- `_user_facing_workbook_names`  (serve_b2b.py:7925-7947)
- `_validRegroup`  (record-review.js:69-69)
- `_vba_security_scan`  (serve_b2b.py:7450-7460)
- `_vba_strip_strings_and_comments`  (serve_b2b.py:7440-7447)
- `_verify_capture_sheet_aoa`  (serve_b2b.py:14089-14112)
- `_verify_recorded_expected_live`  (serve_b2b.py:6635-6697)
- `_verify_step_isolated_impl`  (serve_b2b.py:14115-14204)
- `_visible_excel_top_hwnds_for_pids`  (serve_b2b.py:4072-4108)
- `_vllm_chat_once`  (serve_b2b.py:6736-6751)
- `_vllm_health_probe`  (serve_b2b.py:6711-6733)
- `_wrap_ctx_helper_kwargs`  (serve_b2b.py:17303-17320)
- `addField`  (assist-core.js:673-673)
- `addMsg`  (assist-popup.js:35-35)
- `applyMappedSingleStep`  (pipeline.js:4683-4683)
- `armStall`  (assist-core.js:297-297)
- `askAssist`  (pipeline.js:7517-7517)
- `assistAbortCurrent`  (assist-core.js:252-252)
- `assistAddMsg`  (assist-ui.js:218-218)
- `assistApplyCompanions`  (assist-core.js:781-781)
- `assistBindDrag`  (assist-ui.js:533-533)
- `assistBuildConversationText`  (assist-report.js:114-114)
- `assistBuildDiagnosticsText`  (assist-report.js:89-89)
- `assistBuildDiffHtml`  (assist-ui.js:512-512)
- `assistBuildJiraGuideText`  (assist-report.js:21-21)
- `assistBuildProposal`  (assist-core.js:549-549)
- `assistCallSignature`  (assist-guard.js:131-131)
- `assistClampIntoView`  (assist-ui.js:34-34)
- `assistClearAttachments`  (assist-ui.js:165-165)
- `assistCommitProposal`  (assist-core.js:801-801)
- `assistConsumeProposal`  (assist-guard.js:192-192)
- `assistDefineTool`  (assist-tools.js:14-14)
- `assistEnsureDom`  (assist-ui.js:43-43)
- `assistEnsureNativeBridge`  (assist-ui.js:622-622)
- `assistHandleBridgeMessage`  (assist-ui.js:634-634)
- `assistHandleUserMessage`  (assist-core.js:261-261)
- `assistHasChineseLeak`  (assist-guard.js:122-122)
- `assistHashCode`  (assist-guard.js:141-141)
- `assistHistoryMessages`  (assist-llm.js:23-23)
- `assistIsBusy`  (assist-core.js:251-251)
- `assistLoadRect`  (assist-ui.js:19-19)
- `assistLooksLikeDanglingAnnouncement`  (assist-core.js:229-229)
- `assistLooksLikeFakeButtonNarration`  (assist-core.js:241-241)
- `assistNativeShellAvailable`  (assist-ui.js:607-607)
- `assistOpenAndAsk`  (assist-ui.js:743-743)
- `assistParseAction`  (assist-guard.js:18-18)
- `assistPostToHost`  (assist-ui.js:610-610)
- `assistPrepareReportBundle`  (assist-report.js:124-124)
- `assistProposalIsVerifiable`  (assist-core.js:746-746)
- `assistPushAssistant`  (assist-core.js:523-523)
- `assistPutToDesignChat`  (assist-ui.js:290-290)
- `assistRenderAttachments`  (assist-ui.js:153-153)
- `assistRenderChips`  (assist-ui.js:197-197)
- `assistRenderHandoffCard`  (assist-ui.js:297-297)
- `assistRenderPlainText`  (assist-ui.js:211-211)
- `assistRenderProposalCard`  (assist-ui.js:454-454)
- `assistRenderReportCard`  (assist-ui.js:354-354)
- `assistReportResultHtml`  (assist-ui.js:382-382)
- `assistReportTimestamp`  (assist-report.js:14-14)
- `assistRunTool`  (assist-tools.js:24-24)
- `assistSaveRect`  (assist-ui.js:26-26)
- `assistSendToPopup`  (assist-ui.js:613-613)
- `assistSetButtonOn`  (assist-ui.js:617-617)
- `assistSetStatus`  (assist-ui.js:234-234)
- `assistStoreProposal`  (assist-guard.js:148-148)
- `assistStripActionBlock`  (assist-guard.js:114-114)
- `assistStripThink`  (assist-llm.js:53-53)
- `assistSubmit`  (assist-ui.js:260-260)
- `assistSystemPrompt`  (assist-core.js:26-26)
- `assistTakeProposal`  (assist-guard.js:158-158)
- `assistToggleDrawer`  (assist-ui.js:572-572)
- `assistToolCatalog`  (assist-tools.js:18-18)
- `assistUploadAttachments`  (assist-ui.js:172-172)
- `assistVerifyBadgeHtml`  (assist-ui.js:440-440)
- `assistVerifyProposal`  (assist-core.js:763-763)
- `beginMappedPipelineRun`  (pipeline.js:4811-4811)
- `bind`  (soft-refresh.js:313-313)
- `bindActions`  (assist-ui.js:472-472)
- `boot`  (soft-refresh.js:336-336)
- `buildDiffHtml`  (assist-popup.js:77-77)
- `callAssistLLM`  (assist-llm.js:61-61)
- `cfgOf`  (drop-handling.js:630-630)
- `clearRunnerLogic`  (drop-handling.js:509-509)
- `clip`  (record-review.js:365-365)
- `clkClassify`  (debug-panel.js:130-130)
- `clkClick`  (debug-panel.js:176-176)
- `clkDbl`  (debug-panel.js:182-182)
- `clkDown`  (debug-panel.js:151-151)
- `clkEsc`  (debug-panel.js:127-127)
- `clkTag`  (debug-panel.js:118-118)
- `clkUp`  (debug-panel.js:163-163)
- `colIdx`  (assist-tools.js:259-259)
- `collectSoftRefreshSnapshot`  (soft-refresh.js:24-24)
- `commit`  (pipeline.js:3404-3404)
- `crossWriteDestinationFileIds`  (pipeline.js:941-941)
- `currentInputSignature`  (save-load.js:72-72)
- `decimalSplitNumberExtractFailures`  (chat-ui.js:615-615)
- `dispatch`  (click-recovery.js:83-83)
- `down`  (assist-ui.js:538-538)
- `dump`  (assist-report.js:91-91)
- `envConfigSheetNames`  (save-load.js:208-208)
- `esc`  (drop-handling.js:2015-2015)
- `escalateExcelStopToForceRestart`  (pipeline.js:1759-1759)
- `estimateRegroupPromptTokens`  (record-review.js:61-61)
- `excelPipelineProgressSignature`  (pipeline.js:1727-1727)
- `excel_record_start`  (serve_b2b.py:6418-6469)
- `excel_record_status`  (serve_b2b.py:6628-6632)
- `excel_record_stop`  (serve_b2b.py:6505-6625)
- `excel_record_verify`  (serve_b2b.py:6700-6704)
- `fetchExcelPipelineProgress`  (pipeline.js:1714-1714)
- `findCfg`  (drop-handling.js:698-698)
- `gridVaultFor`  (record-review.js:259-259)
- `handlePipelineStepToggle`  (pipeline.js:3636-3636)
- `initAppVersionLabel`  (app-version.js:14-14)
- `isEditable`  (click-recovery.js:57-57)
- `isInternalTempWorkbookName`  (save-load.js:640-640)
- `keyOf`  (save-load.js:780-780)
- `liveEnabledStepsSignatureParts`  (pipeline.js:3862-3862)
- `llmApplyIntentToStep`  (record-review.js:264-264)
- `llmConsolidateEntries`  (record-review.js:337-337)
- `llmRegroupRecordedSteps`  (record-review.js:106-106)
- `llmSplitRecordedVba`  (record-review.js:599-599)
- `loadVersionCheckSettings`  (config.js:92-92)
- `makeStep`  (pipeline.js:6740-6740)
- `mappings`  (assist-tools.js:542-542)
- `markHeld`  (pipeline.js:3672-3672)
- `markLivePipelineOutOfSync`  (excel-mirror.js:1137-1137)
- `matchFillIntent`  (chat-ui.js:779-779)
- `mergeAliases`  (drop-handling.js:661-661)
- `mergeInvariantSignature`  (record-review.js:205-205)
- `move`  (assist-ui.js:547-547)
- `normalizeDevVllmBaseUrl`  (config.js:337-337)
- `normalizeStaleBooksInSavedText`  (save-load.js:805-805)
- `normalizeStaleTargetFileIdForSave`  (save-load.js:697-697)
- `normalizeVersionText`  (config.js:144-144)
- `ok`  (pipeline.js:437-437)
- `onBridge`  (assist-popup.js:327-327)
- `onCommitResult`  (assist-popup.js:178-178)
- `onDelta`  (assist-core.js:304-304)
- `onKey`  (drop-handling.js:2051-2051)
- `onRealClick`  (click-recovery.js:126-126)
- `onRealDbl`  (click-recovery.js:134-134)
- `onReportResult`  (assist-popup.js:264-264)
- `openAICompatAuthHeaders`  (config.js:52-52)
- `openBatchResumeModal`  (pipeline.js:4487-4487)
- `openLabelRename`  (pipeline.js:3427-3427)
- `openRunnerLogicEditor`  (drop-handling.js:466-466)
- `originHistIdForPrompt`  (chat-ui.js:155-155)
- `p`  (assist-report.js:16-16)
- `pass`  (assist-tools.js:279-279)
- `pipelineForSave`  (save-load.js:179-179)
- `pipelineFullRunStateSig`  (pipeline.js:163-163)
- `pipelineHeldBatchInfo`  (pipeline.js:4368-4368)
- `pipelineLiveStateSig`  (pipeline.js:148-148)
- `pipelineLooksLikeDateNumber`  (pipeline.js:436-436)
- `pipelineLooksLikeHms`  (pipeline.js:428-428)
- `pipelineLooksLikeYmd`  (pipeline.js:432-432)
- `pipelineStableWorkbookKey`  (pipeline.js:449-449)
- `pipelineStepWritesCrossFile`  (pipeline.js:999-999)
- `pipelineStripCodeComments`  (pipeline.js:933-933)
- `pipelineSuffixWritesCrossFile`  (pipeline.js:1011-1011)
- `pipelineTimeoutMs`  (pipeline.js:5029-5029)
- `pipelineVbaStringVars`  (pipeline.js:574-574)
- `promise`  (pipeline.js:2482-2482)
- `promoteStepChatOrigins`  (save-load.js:964-964)
- `proposalBody`  (assist-popup.js:98-98)
- `protectLargeGridLiterals`  (record-review.js:235-235)
- `refreshBatchResumeButton`  (pipeline.js:4393-4393)
- `refreshSaveBaseNameToCurrentInputs`  (save-load.js:94-94)
- `related`  (click-recovery.js:64-64)
- `renderAttach`  (assist-popup.js:378-378)
- `renderClick`  (debug-panel.js:190-190)
- `renderHandoff`  (assist-popup.js:281-281)
- `renderProposal`  (assist-popup.js:140-140)
- `renderReport`  (assist-popup.js:241-241)
- `render_pptx_to_slides_b64`  (serve_b2b.py:1142-1207)
- `repairPasteCopiedInternalBookNames`  (save-load.js:652-652)
- `repairStalePromptBookNames`  (save-load.js:767-767)
- `repairStaleTargetFileIds`  (save-load.js:715-715)
- `resetClick`  (debug-panel.js:183-183)
- `resolveName`  (save-load.js:781-781)
- `restore`  (assist-ui.js:275-275)
- `restoreLargeGridLiterals`  (record-review.js:245-245)
- `restoreSoftRefreshSnapshot`  (soft-refresh.js:157-157)
- `revertAll`  (pipeline.js:3685-3685)
- `revertOn`  (pipeline.js:3759-3759)
- `run`  (pipeline.js:4526-4526)
- `runHeldStepsBatch`  (pipeline.js:4525-4525)
- `runVersionCheck`  (config.js:155-155)
- `runnerAddGeneratedSheet`  (drop-handling.js:771-771)
- `runnerAddPairedCodeRequirements`  (drop-handling.js:1089-1089)
- `runnerAddRequirement`  (drop-handling.js:752-752)
- `runnerApplyEnvConfigFilter`  (drop-handling.js:685-685)
- `runnerBuildMappingRows`  (drop-handling.js:1508-1508)
- `runnerCanonicalizeRequirementsByEnv`  (drop-handling.js:607-607)
- `runnerChipLabel`  (drop-handling.js:1595-1595)
- `runnerCleanWorkbookRequirementName`  (drop-handling.js:577-577)
- `runnerCurrentMappingSignature`  (drop-handling.js:1490-1490)
- `runnerDisplaySheetName`  (drop-handling.js:1604-1604)
- `runnerExtractGeneratedSheetsFromCode`  (drop-handling.js:876-876)
- `runnerExtractMappingRequirements`  (drop-handling.js:1221-1221)
- `runnerFindAutoFile`  (drop-handling.js:1392-1392)
- `runnerFindSheet`  (drop-handling.js:1444-1444)
- `runnerGeneratedSheetNameSet`  (drop-handling.js:1430-1430)
- `runnerGroupMappingRowsByFile`  (drop-handling.js:1559-1559)
- `runnerIsGeneratedSheet`  (drop-handling.js:777-777)
- `runnerIsSkillDefaultSheet`  (drop-handling.js:872-872)
- `runnerLooksLikeA1Address`  (drop-handling.js:760-760)
- `runnerMappingFileId`  (drop-handling.js:526-526)
- `runnerMappingHasBlockingMissing`  (drop-handling.js:1589-1589)
- `runnerMappingKey`  (drop-handling.js:573-573)
- `runnerMappingKnownFiles`  (drop-handling.js:533-533)
- `runnerMappingNorm`  (drop-handling.js:564-564)
- `runnerMappingScoreFile`  (drop-handling.js:1377-1377)
- `runnerMappingSheetNames`  (drop-handling.js:560-560)
- `runnerMappingStem`  (drop-handling.js:569-569)
- `runnerPyBookVarMap`  (drop-handling.js:793-793)
- `runnerRecordedActivatePairs`  (drop-handling.js:1077-1077)
- `runnerRefreshUnreliableSheetNames`  (drop-handling.js:1734-1734)
- `runnerRenderMappingPanel`  (drop-handling.js:1610-1610)
- `runnerReplaceLiteral`  (drop-handling.js:1786-1786)
- `runnerResetMappingIfSourceChanged`  (drop-handling.js:1496-1496)
- `runnerSheetOwnersFromCode`  (drop-handling.js:1154-1154)
- `runnerSliceCallArgs`  (drop-handling.js:846-846)
- `runnerSplitTopLevelArgs`  (drop-handling.js:825-825)
- `saveVersionCheckSettings`  (config.js:130-130)
- `say`  (assist-core.js:263-263)
- `selText`  (assist-tools.js:533-533)
- `send`  (assist-ui.js:103-103)
- `setBusy`  (assist-popup.js:207-207)
- `setStatus`  (assist-popup.js:50-50)
- `setUi`  (pipeline.js:6429-6429)
- `sheetCanonOf`  (drop-handling.js:639-639)
- `shouldSkipRequirement`  (drop-handling.js:1237-1237)
- `showRecordReviewDialog`  (record-review.js:357-357)
- `skill_consolidate`  (serve_b2b.py:6754-6775)
- `softRefreshApp`  (soft-refresh.js:65-65)
- `stable`  (drop-handling.js:693-693)
- `stashGridVault`  (record-review.js:253-253)
- `stepChatOriginless`  (chat-ui.js:168-168)
- `submit`  (assist-popup.js:213-213)
- `swallowable`  (click-recovery.js:74-74)
- `syncOk`  (pipeline.js:4454-4454)
- `takeMatch`  (click-recovery.js:77-77)
- `traceOff`  (pipeline.js:3678-3678)
- `tracePipelineRun`  (pipeline.js:3984-3984)
- `traceToggleOnRoute`  (pipeline.js:3993-3993)
- `tryJson`  (assist-guard.js:20-20)
- `up`  (assist-ui.js:558-558)
- `uploadAttachments`  (assist-popup.js:225-225)
- `verifyBadge`  (assist-popup.js:127-127)
- `verifyPrefixRestoreCoverage`  (pipeline.js:4148-4148)
- `verify_step_isolated`  (serve_b2b.py:14207-14215)
- `versionCheckUpstreamBase`  (config.js:115-115)
- `versionCheckUpstreamEndpoint`  (config.js:125-125)
- `waitRestoreOrStall`  (pipeline.js:1737-1737)

## 변경된 함수 (시그니처/관계/사이드이펙트)
### `B2BHandler.do_GET`  (serve_b2b.py:1227-1295)
- **calls**: +[_current_app_version]

### `B2BHandler.do_POST`  (serve_b2b.py:1297-1526)
- **calls**: +[_force_kill_pid, _is_pid_alive, _join_inflight_kills, _perf_trace, _vba_trace, cleanup_backend_runtime_files, cleanup_node_worker, handle_assist_attachment, handle_diag_recent_trace, handle_excel_preview_schema, handle_excel_record_start, handle_excel_record_status, handle_excel_record_stop, handle_excel_record_verify, handle_excel_runner_mode, handle_excel_verify_step, handle_pipeline_live_final_snapshot, handle_skill_consolidate, handle_workbook_reinspect]
- **side_effects**: +[상태 변경(전역/세션): HOST_MINIMIZED] -[없음(정적 분석 기준)]
- **reads**: +[HOST_MINIMIZED, SPAWNED_EXCEL_PIDS, self.handle_assist_attachment, self.handle_diag_recent_trace, self.handle_excel_preview_schema, self.handle_excel_record_start, self.handle_excel_record_status, self.handle_excel_record_stop, self.handle_excel_record_verify, self.handle_excel_runner_mode, self.handle_excel_verify_step, self.handle_pipeline_live_final_snapshot, self.handle_skill_consolidate, self.handle_workbook_reinspect]
- **writes**: +[HOST_MINIMIZED]

### `B2BHandler.handle_excel_activate`  (serve_b2b.py:2196-2207)
- **calls**: +[_reject_show_while_host_minimized]
- **reads**: +[self._reject_show_while_host_minimized]

### `B2BHandler.handle_excel_capture_copypaste`  (serve_b2b.py:2021-2046)
- **calls**: +[excel_record_status]
- **reads**: +[NATIVE_RECORDING]

### `B2BHandler.handle_excel_open`  (serve_b2b.py:1920-1953)
- **calls**: +[_hide_if_host_minimized]
- **reads**: +[self._hide_if_host_minimized]

### `B2BHandler.handle_excel_open_result`  (serve_b2b.py:1967-2000)
- **calls**: +[_hide_if_host_minimized]
- **reads**: +[self._hide_if_host_minimized]

### `B2BHandler.handle_excel_position`  (serve_b2b.py:2209-2233)
- **calls**: +[_reject_show_while_host_minimized]
- **reads**: +[self._reject_show_while_host_minimized]

### `B2BHandler.handle_excel_raise`  (serve_b2b.py:2286-2293)
- **calls**: +[_reject_show_while_host_minimized]
- **reads**: +[self._reject_show_while_host_minimized]

### `B2BHandler.handle_excel_recover`  (serve_b2b.py:2261-2284)
- **calls**: +[_reject_show_while_host_minimized]
- **reads**: +[self._reject_show_while_host_minimized]

### `B2BHandler.handle_excel_show_only`  (serve_b2b.py:2235-2259)
- **calls**: +[_reject_show_while_host_minimized]
- **reads**: +[self._reject_show_while_host_minimized]

### `B2BHandler.handle_workbook_upload`  (serve_b2b.py:1601-1656)
- **calls**: +[_vba_trace, values]

### `HandleDownloadStarting`  (NativeHost.cs:883-883)
- **calls**: +[ForceHostForeground, NotifyWebToast]
- **side_effects**: +[WebView2 조작]

### `HandleHostResize`  (NativeHost.cs:1506-1506)
- **calls**: +[PostHostMinimizedState]

### `HandleWebMessage`  (NativeHost.cs:695-695)
- **calls**: +[HandleAssistPopupCommand, RelayToAssistPopup]

### `Main`  (NativeHost.cs:65-65)
- **calls**: +[RotateLogAtStartup]

### `PythonComSkillContext.__init__`  (serve_b2b.py:10817-10837)
- **calls**: +[_py_skill_deadline]
- **reads**: -[PY_SKILL_TIMEOUT_S]

### `PythonComSkillContext.book`  (serve_b2b.py:13569-13681)
- **calls**: +[_user_facing_workbook_names]

### `PythonComSkillContext.copy`  (serve_b2b.py:11356-11394)
- **calls**: +[_mirror_unprotected_for_paste]

### `PythonComSkillContext.copy_values`  (serve_b2b.py:12313-12341)
- **calls**: +[_mirror_unprotected_for_paste]

### `PythonComSkillContext.paste_copied`  (serve_b2b.py:11396-11501)
- **calls**: +[_mirror_unprotected_for_paste]

### `PythonComSkillContext.pivot`  (serve_b2b.py:12155-12184)
- **calls**: +[Worksheets, _vba_trace, native_pivot] -[_col0, _col_index, _pivot_crosstab, _tick, add_sheet, append, range, read, replace, values, write]
- **reads**: +[self.native_pivot] -[self._col_index, self._shared, self._tick, self.add_sheet, self.read, self.write]

### `PythonComSkillContext.read`  (serve_b2b.py:11190-11218)
- **calls**: +[_note_read_evidence]
- **reads**: +[self._note_read_evidence]

### `PythonComSkillContext.read_formulas`  (serve_b2b.py:11226-11239)
- **calls**: +[_note_read_evidence]
- **reads**: +[self._note_read_evidence]

### `PythonComSkillContext.write`  (serve_b2b.py:11271-11310)
- **reads**: +[self._shared]

### `WndProc`  (NativeHost.cs:1443-1443)
- **calls**: +[ClickHiddenButton]

### `_capture_browser_hwnd`  (serve_b2b.py:3583-3627)
- **calls**: +[replace]

### `_capture_copypaste_on_session_impl`  (serve_b2b.py:10540-10685)
- **calls**: +[_user_facing_workbook_name_for_live]

### `_cleanup_excel_sessions_impl`  (serve_b2b.py:838-891)
- **calls**: +[_note_live_app_reset]

### `_clear_workbook_name_aliases`  (serve_b2b.py:8064-8071)
- **reads**: +[_WB_NAME_REVERSE_ALIASES]

### `_close_excel_session_impl`  (serve_b2b.py:7244-7309)
- **calls**: +[_note_live_app_reset]
- **reads**: +[NATIVE_RECORDING]

### `_configure_excel_grid_window`  (serve_b2b.py:3498-3530)
- **calls**: +[_recording_edit_unlock_active, _set_display_prop_if_changed]

### `_configure_read_only_mirror_input_block`  (serve_b2b.py:3434-3453)
- **calls**: +[_recording_edit_unlock_active]

### `_disable_excel_context_menus`  (serve_b2b.py:3478-3495)
- **calls**: +[_recording_edit_unlock_active]

### `_ensure_excel_workbook_view`  (serve_b2b.py:3531-3580)
- **calls**: +[_set_display_prop_if_changed]

### `_exec_python_com_skill`  (serve_b2b.py:13940-14023)
- **calls**: +[_py_skill_deadline, _vba_trace]
- **reads**: -[PY_SKILL_TIMEOUT_S]

### `_force_restart_excel_sessions_direct`  (serve_b2b.py:894-1016)
- **signature**: () → (wait=False)
- **calls**: +[_note_live_app_reset]
- **reads**: +[NATIVE_RECORDING, PIPELINE_JOBS, PIPELINE_JOBS_LOCK, _KILL_INFLIGHT, _KILL_INFLIGHT_LOCK]

### `_get_live_excel_app`  (serve_b2b.py:4944-4998)
- **calls**: +[_excel_process_id, _is_pid_alive, _note_live_app_reset, _vba_trace]
- **side_effects**: +[상태 변경(전역/세션): LIVE_EXCEL_APP, LIVE_EXCEL_APP_PID] -[상태 변경(전역/세션): LIVE_EXCEL_APP]
- **reads**: +[LIVE_EXCEL_APP_PID, NATIVE_RECORDING]
- **writes**: +[LIVE_EXCEL_APP_PID]

### `_hide_all_excel_sessions_impl`  (serve_b2b.py:7146-7220)
- **calls**: +[_hide_excel_windows_for_pid, _visible_excel_top_hwnds_for_pids, add]
- **reads**: +[SPAWNED_EXCEL_PIDS]

### `_inject_and_run_vba`  (serve_b2b.py:8822-8882)
- **calls**: +[_normalize_vba_llm_comment_slips]

### `_live_preview_schema`  (serve_b2b.py:14371-14411)
- **signature**: (wb, max_rows=60, max_cols=_SNAPSHOT_MAX_COLS) → (wb, max_rows=60, max_cols=_SNAPSHOT_MAX_COLS, only_sheet=None)

### `_move_hwnd_offscreen`  (serve_b2b.py:4051-4069)
- **calls**: +[_unmaximize_hwnd_no_activate]

### `_open_excel_session_impl`  (serve_b2b.py:5108-5525)
- **signature**: (path, name=None, workbook_id=None, result_id=None, read_only_mirror=False, left=None, top=None, width=None, height=None, client_left=None, client_top=None, client_width=None, client_height=None, viewport_width=None, viewport_height=None, browser_title=None, native_parent_hwnd=None, native_host_hwnd=None, native_overlay=False, live_editable=False, defer_visible=False) → (path, name=None, workbook_id=None, result_id=None, read_only_mirror=False, left=None, top=None, width=None, height=None, client_left=None, client_top=None, client_width=None, client_height=None, viewport_width=None, viewport_height=None, browser_title=None, native_parent_hwnd=None, native_host_hwnd=None, native_overlay=False, live_editable=False, defer_visible=False, from_state_sig=None)
- **calls**: +[_find_live_final_snapshot, _vba_trace]
- **side_effects**: +[상태 변경(전역/세션): EXCEL_SESSIONS, LIVE_RESTORE_SUPPRESSED] -[상태 변경(전역/세션): EXCEL_SESSIONS]
- **reads**: +[RECORDING_EDIT_UNLOCKED, WORKBOOKS]
- **writes**: +[LIVE_RESTORE_SUPPRESSED]

### `_position_excel_window`  (serve_b2b.py:3704-3882)
- **calls**: +[_unmaximize_hwnd_no_activate]

### `_present_live_session_frame`  (serve_b2b.py:6778-6875)
- **calls**: +[_enable_excel_context_menus, _is_live_shared_app, _protect_workbook_for_read_only_mirror, _restore_excel_default_input, _set_excel_ribbon_visible]
- **reads**: +[LIVE_RESTORE_SUPPRESSED, RECORDING_EDIT_UNLOCKED]

### `_protect_workbook_for_read_only_mirror`  (serve_b2b.py:3331-3348)
- **calls**: +[_protect_sheet_for_read_only_mirror, _recording_edit_unlock_active] -[_allow_read_only_mirror_selection]

### `_quit_live_excel_app`  (serve_b2b.py:5082-5093)
- **calls**: +[_note_live_app_reset]

### `_run_excel_python_pipeline_impl`  (serve_b2b.py:18342-18793)
- **calls**: +[_save_live_final_snapshot]

### `_run_full_pipeline_single_instance_impl`  (serve_b2b.py:9957-10351)
- **signature**: (groups, reset_excel_ids=None, view_sheet=None, entry=None, output_mode='sync') → (groups, reset_excel_ids=None, view_sheet=None, entry=None, output_mode='sync', state_sig=None)
- **calls**: +[_save_live_final_snapshot, _warn_excel_nonfatal]
- **reads**: +[WORKBOOKS]

### `_run_low_risk_housekeeping`  (serve_b2b.py:4590-4649)
- **reads**: +[HOUSEKEEPING_INTERVAL_SECONDS, RUNTIME_LAST_ACTIVITY_AT]

### `_run_vba_pipeline_on_session_impl`  (serve_b2b.py:9577-9946)
- **calls**: +[_promote_csv_multisheet_name]

### `_runtime_maintenance_loop`  (serve_b2b.py:4652-4670)
- **reads**: +[PARENT_WATCH_INTERVAL_SECONDS]

### `_runtime_sampler_once`  (serve_b2b.py:4539-4580)
- **calls**: +[_pipeline_is_busy]
- **side_effects**: +[상태 변경(전역/세션): RUNTIME_LAST_ACTIVITY_AT, RUNTIME_LAST_ACTIVITY_SIG] -[없음(정적 분석 기준)]
- **reads**: +[RUNTIME_LAST_ACTIVITY_SIG]
- **writes**: +[RUNTIME_LAST_ACTIVITY_AT, RUNTIME_LAST_ACTIVITY_SIG]

### `_save_excel_session_impl`  (serve_b2b.py:5640-5767)
- **signature**: (excel_id, name=None) → (excel_id, name=None, internal=False)
- **calls**: +[_promote_csv_multisheet_name]

### `_show_excel_formula_bar`  (serve_b2b.py:3472-3475)
- **calls**: +[_set_display_prop_if_changed]

### `_stable_workbook_key`  (serve_b2b.py:7900-7922)
- **calls**: +[range]
- **reads**: +[_VOLATILE_SUFFIX_TOKENS]

### `_stash_workbook_name_alias`  (serve_b2b.py:8043-8061)
- **reads**: +[_WB_NAME_REVERSE_ALIASES]

### `_validate_vba_source_before_inject`  (serve_b2b.py:7463-7581)
- **calls**: +[_vba_security_scan, _vba_strip_strings_and_comments]

### `addAssistantReply`  (chat-ui.js:2354-2354)
- **calls**: +[originHistIdForPrompt]

### `applyForcedPythonFallback`  (chat-ui.js:1912-1912)
- **calls**: +[originHistIdForPrompt]

### `applyLiveSchemaToFileCache`  (pipeline.js:4762-4762)
- **reads**: +[state.inputsOriginal]

### `applyLogic`  (pipeline.js:2049-2049)
- **calls**: +[canUsePipelineCheckpointFromIndex, getPipelineResumeFromIndex, insertLogic, isStepEnabled, requestExcelApplyCancel, runFromCheckpointAfterEdit]
- **side_effects**: +[상태 변경: pipeline]
- **writes**: +[pipeline]

### `attemptRunnerAutoRecovery`  (pipeline.js:7407-7407)
- **calls**: +[beginMappedPipelineRun, clearPipelineResumeFromIndex, restore, sync]

### `buildLogicZipEntries`  (save-load.js:188-188)
- **calls**: +[_buildLogicZipEntriesImpl, pipelineForSave] -[currentLogicSaveBaseName, getPipelineRuntimeStatus, isStepEnabled, push, stripLogicTimestampSuffix]
- **side_effects**: +[상태 변경: pipeline] -[없음(정적 분석 기준)]
- **reads**: -[state.chatHistory]
- **writes**: +[pipeline]

### `callLLMOneShot`  (llm-api.js:118-118)
- **calls**: +[openAICompatAuthHeaders]

### `callOpenAICompatOnce`  (llm-api.js:220-220)
- **calls**: +[_pushAssistant, openAICompatAuthHeaders]

### `canFastEditLastPipelineStep`  (pipeline.js:4059-4059)
- **calls**: +[pipelineStepWritesCrossFile]

### `canUsePipelineCheckpointFromIndex`  (pipeline.js:4652-4652)
- **calls**: +[isStepEnabled, pipelineSuffixWritesCrossFile]

### `clarifyVerifierAskIfNeeded`  (chat-ui.js:3438-3438)
- **calls**: +[_clarifySeparatorWhitespaceQuestion]

### `cleanup_stale_temp_artifacts`  (serve_b2b.py:568-727)
- **calls**: +[_is_pid_alive]

### `clearPipelineResumeFromIndex`  (pipeline.js:242-242)
- **calls**: +[refreshBatchResumeButton]

### `close`  (record-review.js:408-408)
- **signature**: () → (result)
- **calls**: -[post]

### `columnMoveIntent`  (chat-ui.js:871-871)
- **calls**: +[move]

### `crossOutputFileIdsReferencedInCode`  (pipeline.js:904-904)
- **calls**: +[pipelineStableWorkbookKey]

### `currentLogicSaveBaseName`  (save-load.js:110-110)
- **calls**: +[currentInputSignature, refreshSaveBaseNameToCurrentInputs]
- **reads**: +[state.logicSaveInputSig]

### `downloadCurrentWorkbookFile`  (output-template.js:8-8)
- **calls**: +[fileIdForExcelMirrorId]
- **side_effects**: +[DOM/브라우저 전역 조작]

### `ensureExcelMirrorSession`  (excel-mirror.js:559-559)
- **calls**: +[hideAllExcelMirrorWindows]

### `ensurePanel`  (debug-panel.js:43-43)
- **calls**: +[renderClick, resetClick]

### `explainPipelineErrorForUser`  (pipeline.js:6997-6997)
- **calls**: +[_recordedLike, buildSheetStructureDigest, getFile, push]
- **reads**: +[state.chatHistory, state.pipeline]

### `insertLogic`  (pipeline.js:2178-2178)
- **calls**: +[_demoteHeld, applyMappedSingleStep, clearPipelineResumeFromIndex, getPipelineResumeFromIndex, isStepEnabled, pipelineHasBackendOnlyStep, pipelineStepLiveLanguage, pipelineStepWritesCrossFile, setPipelineResumeFromIndex]

### `inspect_workbook`  (serve_b2b.py:18886-19000)
- **calls**: +[_vba_trace, excel_call, range, sheets]
- **reads**: +[EXCEL_THREAD]

### `inspect_workbook_fallback`  (serve_b2b.py:19003-19023)
- **calls**: +[csv_sheet_name]

### `loadLogic`  (save-load.js:985-985)
- **calls**: +[clearPipelineResumeFromIndex, openRunnerLogicEditor, promoteStepChatOrigins, repairStalePromptBookNames, repairStaleTargetFileIds, runnerReplaceLiteral]
- **side_effects**: +[DOM/브라우저 전역 조작, 상태 변경: chatHistory, editingStepId, pipeline, skillEnvConfig] -[상태 변경: chatHistory, editingStepId, pipeline]
- **reads**: +[state.skillEnvConfig]
- **writes**: +[skillEnvConfig]

### `loadLogicFiles`  (save-load.js:816-816)
- **calls**: +[repairPasteCopiedInternalBookNames]

### `maybeAutoReapplyAfterRecover`  (excel-mirror.js:1157-1157)
- **calls**: +[markLivePipelineOutOfSync]

### `norm`  (drop-handling.js:692-692)
- **signature**: (v) → (n)

### `normalizeSettings`  (config.js:266-266)
- **calls**: +[normalizeDevVllmBaseUrl]

### `noteLivePipelineApplied`  (pipeline.js:3902-3902)
- **calls**: +[_signatureStepsAsRestored, getPipelineRuntimeStatus, isStepEnabled, liveEnabledStepsSignatureParts]

### `openSettingsModal`  (model-modal.js:123-123)
- **calls**: +[loadVersionCheckSettings, openAICompatAuthHeaders, runVersionCheck, saveVersionCheckSettings]

### `open_excel_session`  (serve_b2b.py:14765-14814)
- **signature**: (path, name=None, workbook_id=None, result_id=None, read_only_mirror=False, left=None, top=None, width=None, height=None, client_left=None, client_top=None, client_width=None, client_height=None, viewport_width=None, viewport_height=None, browser_title=None, native_parent_hwnd=None, native_host_hwnd=None, native_overlay=False, live_editable=False, defer_visible=False) → (path, name=None, workbook_id=None, result_id=None, read_only_mirror=False, left=None, top=None, width=None, height=None, client_left=None, client_top=None, client_width=None, client_height=None, viewport_width=None, viewport_height=None, browser_title=None, native_parent_hwnd=None, native_host_hwnd=None, native_overlay=False, live_editable=False, defer_visible=False, from_state_sig=None)

### `pipelineEditBusyReason`  (pipeline.js:4748-4748)
- **calls**: +[_pipelineCoreBusyReason]
- **side_effects**: +[없음(정적 분석 기준)] -[DOM/브라우저 전역 조작]

### `pipelineFileIdByWorkbookName`  (pipeline.js:491-491)
- **calls**: +[pipelineStableWorkbookKey]

### `pipelinePythonBookVarNames`  (pipeline.js:739-739)
- **calls**: +[pipelineConstStringVars, pipelineResolvePyArg]

### `pipelinePythonMutatedBookNames`  (pipeline.js:754-754)
- **calls**: +[pipelineConstStringVars, pipelineResolvePyArg]

### `pipelineVbaTargetWorkbookNames`  (pipeline.js:591-591)
- **calls**: +[pipelineVbaStringVars]

### `pythonComStaticSafetyFailures`  (chat-ui.js:1538-1538)
- **side_effects**: +[DOM/브라우저 전역 조작] -[없음(정적 분석 기준)]

### `readOpenAICompatStream`  (llm-api.js:339-339)
- **calls**: +[onDelta]

### `reapplyVbaPipelineToLive`  (pipeline.js:4872-4872)
- **calls**: +[_reapplyVbaPipelineToLiveImpl, beginMappedPipelineRun, markPipelinePendingFromIndex, restore] -[attachPipelineStepError, beginExcelMirrorApplyLoading, crossOutputFileIdsReferencedInCode, currentExcelId, endExcelMirrorApplyLoading, ensurePinnedVbaTargetExcelId, excelIdForPipelineFileId, fileIdForExcelMirrorId, getFile, hideAllExcelMirrorWindows, inferPipelineStepTargetFileId, inferPipelineStepTargetSheetName, invalidateLivePipelineApplied, muteExcelMirrorForPipeline, noteLivePipelineApplied, pipelineHasUnresolvedTarget, pipelinePinnedTargetFileId, pipelineStepLiveLanguage, positionExcelMirrorWindow, postExcelMirror, push, recordVbaDebugTiming, releaseExcelMirrorPipelineMute, requirePipelineSessionExcelId, restoreVbaExcelAfterError, runIsolatedLivePipelineSteps, scheduleRestoreActiveExcelMirror, showOnlyExcelMirrorWindow, stabilizeExcelMirrorZOrder, warnUnresolvedPipelineTarget]
- **side_effects**: +[없음(정적 분석 기준)] -[DOM/브라우저 전역 조작, 네트워크/서버 호출]
- **reads**: -[state.currentFileId]

### `reconcileHistoryRestore`  (history.js:161-161)
- **signature**: () → (previousSteps)

### `reconcilePipelineSimulationAfterEdit`  (pipeline.js:5221-5221)
- **calls**: +[_reconcilePipelineSimulationAfterEditImpl, beginMappedPipelineRun, restore] -[affectedStepViewFileId, affectedStepViewSheetHint, clearPipelineExecutionMemory, ensurePinnedVbaTargetExcelId, excelIdForPipelineFileId, getSkillEngine, hasBackendOnlyWorkbooks, inferPipelineStepLanguage, isStepEnabled, liveEnabledStepsSignature, pipelineHasBackendOnlyStep, pipelineHasUnresolvedTarget, pipelinePinnedTargetFileId, pipelineStepLiveLanguage, pipelineUsesPython, preferredVbaRunFileId, reapplyVbaPipelineToLive, refreshTabs, renderExcelViewer, runPipeline, runPipelinePreferBackend, shouldDeferImmediatePipelineRun, shouldUseFastPreviewPipelineRun, toast, vbaTargetExcelId, warnUnresolvedPipelineTarget]
- **side_effects**: +[없음(정적 분석 기준)] -[DOM/브라우저 전역 조작]
- **reads**: -[state.inputsOriginal, state.outputOriginal, state.pipeline]

### `redoHistory`  (history.js:141-141)
- **calls**: +[pipelineEditBusyReason]
- **side_effects**: +[DOM/브라우저 전역 조작] -[없음(정적 분석 기준)]
- **reads**: +[state.pipeline]

### `refreshRunButton`  (pipeline.js:5405-5405)
- **calls**: +[refreshBatchResumeButton]

### `rememberLogicSaveBaseName`  (save-load.js:154-154)
- **calls**: +[currentInputSignature]
- **side_effects**: +[상태 변경: logicSaveBaseName, logicSaveInputSig] -[상태 변경: logicSaveBaseName]
- **reads**: +[state.logicSaveInputSig]
- **writes**: +[logicSaveInputSig]

### `renderPipeline`  (pipeline.js:3342-3342)
- **calls**: +[commit, handlePipelineStepToggle, openLabelRename, pipelineSuffixWritesCrossFile] -[applyLastEnabledStepFast, clearPipelineResumeFromIndex, liveEnabledStepsSignature, runFromCheckpointAfterEdit]
- **side_effects**: +[상태 변경: editingStepId, pipeline, renamingDraft, renamingSelectAll, renamingStepId] -[상태 변경: editingStepId, pipeline]
- **reads**: +[state.renamingDraft, state.renamingSelectAll, state.renamingStepId]
- **writes**: +[renamingDraft, renamingSelectAll, renamingStepId]

### `renderRunnerWorkflow`  (drop-handling.js:1852-1852)
- **calls**: +[openRunnerLogicEditor, runnerMappingHasBlockingMissing, runnerRenderMappingPanel, runnerResetMappingIfSourceChanged] -[setPage]
- **reads**: +[state.runnerMappingChecked]

### `replaceLogicAt`  (pipeline.js:2365-2365)
- **calls**: +[applyMappedSingleStep, getFile, getPipelineResumeFromIndex, getPipelineRuntimeStatus, markPipelinePendingFromIndex, noteLivePipelineApplied, pipelineEditBusyReason, pipelineHasBackendOnlyStep, pipelineResolveSavedTargetFileId, pipelineStepLiveLanguage, pipelineStepWritesCrossFile, pipelineSuffixWritesCrossFile, restore, restorePipelineToCheckpointAndHold]
- **reads**: +[state.runnerMappingRunActive]

### `reportPipelineError`  (pipeline.js:7129-7129)
- **calls**: +[_assistErrorDiagnoseQuestion, assistOpenAndAsk, traceClientUiEvent]
- **reads**: +[state.pipeline]

### `requestErrorRecovery`  (chat-ui.js:2880-2880)
- **calls**: +[setStatus, traceClientUiEvent]

### `requestExcelApplyCancel`  (pipeline.js:1777-1777)
- **calls**: +[escalateExcelStopToForceRestart, waitRestoreOrStall]

### `restorePipelineToCheckpointAndHold`  (pipeline.js:4171-4171)
- **calls**: +[add, invalidateLivePipelineApplied, restoreLastStepPreApplySnapshot, verifyPrefixRestoreCoverage]

### `runApply`  (chat-ui.js:2450-2450)
- **calls**: +[originHistIdForPrompt]

### `runEditApply`  (chat-ui.js:2387-2387)
- **calls**: +[originHistIdForPrompt]
- **reads**: +[state.pipeline]

### `runFromCheckpointAfterEdit`  (pipeline.js:4302-4302)
- **calls**: +[currentExcelId, reapplyVbaPipelineToLive, toast, vbaTargetExcelId]

### `runInsert`  (chat-ui.js:2468-2468)
- **calls**: +[originHistIdForPrompt]

### `runIsolatedLivePipelineSteps`  (pipeline.js:1147-1147)
- **calls**: +[_offStepsAmongSent, _stepsOnOffMap, _throwIfAbandoned, pipelineFullRunStateSig, pipelineTimeoutMs, toast, tracePipelineRun]

### `runPipelineOnBackend`  (backend-workbooks.js:569-569)
- **calls**: +[pipelineFullRunStateSig]

### `runPipelineSuffixFromCheckpoint`  (pipeline.js:4219-4219)
- **calls**: +[_runPipelineSuffixFromCheckpointImpl, beginMappedPipelineRun, restore] -[clearPipelineResumeFromIndex, currentExcelId, excelIdForPipelineFileId, markPipelinePendingFromIndex, noteLivePipelineApplied, pipelineHasBackendOnlyStep, pipelinePinnedTargetFileId, preferredVbaRunFileId, runIsolatedLivePipelineSteps, setPipelineRuntimeStatus, toast, vbaTargetExcelId]
- **reads**: -[state.pipeline]

### `runVbaPipelinePreferLive`  (pipeline.js:1533-1533)
- **calls**: +[crossWriteDestinationFileIds, push]

### `run_full_pipeline_single_instance`  (serve_b2b.py:10354-10357)
- **signature**: (groups, reset_excel_ids=None, view_sheet=None, entry=None, output_mode='sync') → (groups, reset_excel_ids=None, view_sheet=None, entry=None, output_mode='sync', state_sig=None)
- **reads**: +[PY_UNLIMITED_OUTER_S]

### `run_python_on_session`  (serve_b2b.py:14218-14244)
- **reads**: +[PY_UNLIMITED_OUTER_S]

### `run_vba_pipeline_on_session`  (serve_b2b.py:9953-9954)
- **reads**: +[PY_UNLIMITED_OUTER_S]

### `save_excel_session`  (serve_b2b.py:14821-14822)
- **signature**: (excel_id, name=None) → (excel_id, name=None, internal=False)

### `scrollChatToStepRequest`  (chat-ui.js:242-242)
- **calls**: +[stepChatOriginless, toast]

### `sendChat`  (chat-ui.js:3493-3493)
- **calls**: +[assistIsBusy, matchFillIntent, setStatus]

### `setPage`  (menu.js:4-4)
- **calls**: +[postExcelMirror]
- **side_effects**: +[네트워크/서버 호출]

### `setPipelineResumeFromIndex`  (pipeline.js:233-233)
- **calls**: +[refreshBatchResumeButton]

### `setupStreamingAssistantMessage`  (chat-ui.js:2605-2605)
- **calls**: +[setStatus]

### `shouldSkipHeavyHistory`  (history.js:57-57)
- **calls**: +[toast]
- **side_effects**: +[DOM/브라우저 전역 조작] -[없음(정적 분석 기준)]

### `showRunnerPipelineError`  (pipeline.js:7481-7481)
- **calls**: +[_assistErrorDiagnoseQuestion, askAssist, assistOpenAndAsk] -[attemptRunnerAutoRecovery, resolveRunnerRecoveryStepIndex]

### `switchVisibleExcelMirrorToFileId`  (excel-mirror.js:706-706)
- **calls**: +[_fail, toast, traceClientUiEvent]

### `toggleEditStep`  (pipeline.js:2769-2769)
- **calls**: +[_applyEditPrefill]

### `undoHistory`  (history.js:122-122)
- **calls**: +[pipelineEditBusyReason]
- **side_effects**: +[DOM/브라우저 전역 조작] -[없음(정적 분석 기준)]
- **reads**: +[state.pipeline]

### `validateAssistantCodeBeforeApply`  (chat-ui.js:2044-2044)
- **calls**: +[decimalSplitNumberExtractFailures]

### `vbaStaticSafetyFailures`  (chat-ui.js:1219-1219)
- **calls**: +[routingIntentText]

### `wholeColumnCountRowTwoFailures`  (chat-ui.js:595-595)
- **calls**: +[decimalSplitNumberExtractFailures, matchFillIntent, move]
- **side_effects**: +[DOM/브라우저 전역 조작] -[없음(정적 분석 기준)]

