#!/usr/bin/env ruby
require 'xcodeproj'
require 'fileutils'

project_root = File.expand_path('.')
project_path = File.join(project_root, 'AgentObservability.xcodeproj')

# Remove existing project
FileUtils.rm_rf(project_path)

# Create the Xcode project
project = Xcodeproj::Project.new(project_path)

# Helper to recursively add files
def add_files_recursively(group, dir_path, target, project)
  return unless File.directory?(dir_path)

  Dir.entries(dir_path).sort.each do |entry|
    next if entry.start_with?('.')

    full_path = File.join(dir_path, entry)

    if File.directory?(full_path)
      subgroup = group.new_group(entry, entry)
      add_files_recursively(subgroup, full_path, target, project)
    elsif entry.end_with?('.swift')
      file_ref = group.new_file(full_path)
      target.add_file_references([file_ref])
    end
  end
end

# Create main app target first
app_target = project.new_target(:application, 'AgentObservability', :ios, '18.0', nil, :swift)

# Create test target
test_target = project.new_target(:unit_test_bundle, 'AgentObservabilityTests', :ios, '18.0', nil, :swift)
test_target.add_dependency(app_target)

# Create Sources group and add files
sources_group = project.new_group('Sources', 'Sources')
sources_path = File.join(project_root, 'Sources')
add_files_recursively(sources_group, sources_path, app_target, project)

# Create Tests group and add files
tests_group = project.new_group('Tests', 'Tests')
tests_path = File.join(project_root, 'Tests')
add_files_recursively(tests_group, tests_path, test_target, project)

# Create Resources group and add assets
resources_group = project.new_group('Resources', 'Resources')
assets_path = File.join(project_root, 'Resources', 'Assets.xcassets')
if File.directory?(assets_path)
  assets_ref = resources_group.new_file(assets_path)
  app_target.add_resources([assets_ref])
end

# Configure build settings for Swift 6 and strict concurrency
all_targets = [app_target, test_target]

all_targets.each do |target|
  target.build_configurations.each do |config|
    settings = config.build_settings

    # Swift 6 language mode with strict concurrency
    settings['SWIFT_VERSION'] = '6.0'
    settings['SWIFT_STRICT_CONCURRENCY'] = 'complete'

    # General settings
    settings['PRODUCT_BUNDLE_IDENTIFIER'] = target.name == 'AgentObservability' ? 'com.agentobs.app' : 'com.agentobs.app.tests'
    settings['INFOPLIST_FILE'] = ''
    settings['GENERATE_INFOPLIST_FILE'] = 'YES'
    settings['CURRENT_PROJECT_VERSION'] = '1'
    settings['MARKETING_VERSION'] = '1.0'
    settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
    settings['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon'
    settings['ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME'] = 'AccentColor'

    # Code signing
    settings['CODE_SIGN_STYLE'] = 'Automatic'
    settings['DEVELOPMENT_TEAM'] = ''

    # iOS specific
    settings['IPHONEOS_DEPLOYMENT_TARGET'] = '18.0'
    settings['TARGETED_DEVICE_FAMILY'] = '1,2'
    settings['SUPPORTS_MACCATALYST'] = 'NO'

    # Launch screen configuration
    settings['INFOPLIST_KEY_UILaunchScreen_Generation'] = 'YES'

    # Supported orientations (all orientations for iPad, portrait up for iPhone)
    settings['INFOPLIST_KEY_UISupportedInterfaceOrientations'] = 'UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight'
    settings['INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad'] = 'UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight'

    # Swift settings
    settings['SWIFT_EMIT_LOC_STRINGS'] = 'YES'
    settings['SWIFT_OPTIMIZATION_LEVEL'] = config.name == 'Debug' ? '-Onone' : '-O'
    settings['SWIFT_COMPILATION_MODE'] = config.name == 'Debug' ? 'singlefile' : 'wholemodule'

    # Treat warnings as errors
    settings['SWIFT_TREAT_WARNINGS_AS_ERRORS'] = 'YES'
    settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'YES'

    # Enable warnings
    settings['CLANG_WARN_DOCUMENTATION_COMMENTS'] = 'YES'
    settings['CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER'] = 'YES'

    if config.name == 'Debug'
      settings['DEBUG_INFORMATION_FORMAT'] = 'dwarf'
      settings['ENABLE_TESTABILITY'] = 'YES'
      settings['ONLY_ACTIVE_ARCH'] = 'YES'
      settings['MTL_ENABLE_DEBUG_INFO'] = 'INCLUDE_SOURCE'
      settings['GCC_OPTIMIZATION_LEVEL'] = '0'
      settings['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] = 'DEBUG'
    else
      settings['DEBUG_INFORMATION_FORMAT'] = 'dwarf-with-dsym'
      settings['ENABLE_NS_ASSERTIONS'] = 'NO'
      settings['VALIDATE_PRODUCT'] = 'YES'
      settings['MTL_ENABLE_DEBUG_INFO'] = 'NO'
      settings['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] = ''
    end
  end
end

# Test target specific
test_target.build_configurations.each do |config|
  settings = config.build_settings
  settings['BUNDLE_LOADER'] = '$(TEST_HOST)'
  settings['TEST_HOST'] = '$(BUILT_PRODUCTS_DIR)/AgentObservability.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/AgentObservability'
end

# Project-level build settings
project.build_configurations.each do |config|
  settings = config.build_settings
  settings['ALWAYS_SEARCH_USER_PATHS'] = 'NO'
  settings['CLANG_ANALYZER_NONNULL'] = 'YES'
  settings['CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION'] = 'YES_AGGRESSIVE'
  settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'gnu++20'
  settings['CLANG_ENABLE_MODULES'] = 'YES'
  settings['CLANG_ENABLE_OBJC_ARC'] = 'YES'
  settings['CLANG_ENABLE_OBJC_WEAK'] = 'YES'
  settings['CLANG_WARN_BLOCK_CAPTURE_AUTORELEASING'] = 'YES'
  settings['CLANG_WARN_BOOL_CONVERSION'] = 'YES'
  settings['CLANG_WARN_COMMA'] = 'YES'
  settings['CLANG_WARN_CONSTANT_CONVERSION'] = 'YES'
  settings['CLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS'] = 'YES'
  settings['CLANG_WARN_DIRECT_OBJC_ISA_USAGE'] = 'YES_ERROR'
  settings['CLANG_WARN_EMPTY_BODY'] = 'YES'
  settings['CLANG_WARN_ENUM_CONVERSION'] = 'YES'
  settings['CLANG_WARN_INFINITE_RECURSION'] = 'YES'
  settings['CLANG_WARN_INT_CONVERSION'] = 'YES'
  settings['CLANG_WARN_NON_LITERAL_NULL_CONVERSION'] = 'YES'
  settings['CLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF'] = 'YES'
  settings['CLANG_WARN_OBJC_LITERAL_CONVERSION'] = 'YES'
  settings['CLANG_WARN_OBJC_ROOT_CLASS'] = 'YES_ERROR'
  settings['CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER'] = 'YES'
  settings['CLANG_WARN_RANGE_LOOP_ANALYSIS'] = 'YES'
  settings['CLANG_WARN_STRICT_PROTOTYPES'] = 'YES'
  settings['CLANG_WARN_SUSPICIOUS_MOVE'] = 'YES'
  settings['CLANG_WARN_UNGUARDED_AVAILABILITY'] = 'YES_AGGRESSIVE'
  settings['CLANG_WARN_UNREACHABLE_CODE'] = 'YES'
  settings['CLANG_WARN__DUPLICATE_METHOD_MATCH'] = 'YES'
  settings['COPY_PHASE_STRIP'] = 'NO'
  settings['ENABLE_STRICT_OBJC_MSGSEND'] = 'YES'
  settings['GCC_C_LANGUAGE_STANDARD'] = 'gnu17'
  settings['GCC_NO_COMMON_BLOCKS'] = 'YES'
  settings['GCC_WARN_64_TO_32_BIT_CONVERSION'] = 'YES'
  settings['GCC_WARN_ABOUT_RETURN_TYPE'] = 'YES_ERROR'
  settings['GCC_WARN_UNDECLARED_SELECTOR'] = 'YES'
  settings['GCC_WARN_UNINITIALIZED_AUTOS'] = 'YES_AGGRESSIVE'
  settings['GCC_WARN_UNUSED_FUNCTION'] = 'YES'
  settings['GCC_WARN_UNUSED_VARIABLE'] = 'YES'
  settings['LOCALIZATION_PREFERS_STRING_CATALOGS'] = 'YES'
  settings['SDKROOT'] = 'iphoneos'
  settings['SWIFT_VERSION'] = '6.0'
  settings['SWIFT_STRICT_CONCURRENCY'] = 'complete'

  if config.name == 'Debug'
    settings['ENABLE_TESTABILITY'] = 'YES'
    settings['GCC_DYNAMIC_NO_PIC'] = 'NO'
    settings['GCC_PREPROCESSOR_DEFINITIONS'] = ['DEBUG=1', '$(inherited)']
  else
    settings['ENABLE_NS_ASSERTIONS'] = 'NO'
    settings['VALIDATE_PRODUCT'] = 'YES'
  end
end

# Create schemes
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app_target)
scheme.add_test_target(test_target)
scheme.set_launch_target(app_target)
scheme.save_as(project_path, 'AgentObservability')

# Save project
project.save

puts "Project created at #{project_path}"
puts "Swift 6: enabled"
puts "Strict concurrency: complete"
puts "Files added to targets"
