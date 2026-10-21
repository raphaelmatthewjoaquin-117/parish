-- Current clean schema baseline for Santo Domingo Parish Website.
-- Generated from the supplied schema-only export dated 2026-10-19.
-- Creates the database if needed, then creates schema objects only; no records are included.
-- Run once using a SQL Server account allowed to create databases, against a new/empty instance.
-- Do not run against a database containing objects or data you need to keep.

IF DB_ID(N'ParishDB') IS NULL
BEGIN
    CREATE DATABASE [ParishDB];
END;
GO
USE [ParishDB];
GO
SET NOCOUNT ON;
GO

/****** Object:  Table [dbo].[ApplicationEditLog]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ApplicationEditLog](
	[ApplicationEditLogId] [int] IDENTITY(1,1) NOT NULL,
	[ServiceRequestId] [int] NOT NULL,
	[ChangedBy] [nvarchar](256) NOT NULL,
	[ChangedAt] [datetime2](7) NOT NULL,
	[Changes] [nvarchar](max) NOT NULL,
 CONSTRAINT [PK_ApplicationEditLog] PRIMARY KEY CLUSTERED
(
	[ApplicationEditLogId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AspNetRoles]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AspNetRoles](
	[RoleId] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](255) NOT NULL,
	[NormalizedName] [nvarchar](450) NULL,
PRIMARY KEY CLUSTERED
(
	[RoleId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AspNetUserRoles]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AspNetUserRoles](
	[UserId] [int] NOT NULL,
	[RoleId] [int] NOT NULL,
 CONSTRAINT [PK_AspNetUserRoles] PRIMARY KEY CLUSTERED
(
	[UserId] ASC,
	[RoleId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AspNetUsers]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AspNetUsers](
	[UserId] [int] IDENTITY(1,1) NOT NULL,
	[EmailAddress] [nvarchar](255) NOT NULL,
	[EmailConfirmed] [bit] NOT NULL,
	[PasswordHash] [nvarchar](512) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UserName] [nvarchar](256) NOT NULL,
	[MustChangePassword] [bit] NOT NULL,
PRIMARY KEY CLUSTERED
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_AspNetUsers_Email] UNIQUE NONCLUSTERED
(
	[EmailAddress] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PasswordResetTokens] ******/
CREATE TABLE [dbo].[PasswordResetTokens](
	[PasswordResetTokenId] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[TokenHash] [char](64) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL CONSTRAINT [DF_PasswordResetTokens_CreatedAt] DEFAULT (sysutcdatetime()),
	[ExpiresAt] [datetime2](7) NOT NULL,
	[UsedAt] [datetime2](7) NULL,
 CONSTRAINT [PK_PasswordResetTokens] PRIMARY KEY CLUSTERED
(
	[PasswordResetTokenId] ASC
) ON [PRIMARY],
 CONSTRAINT [UQ_PasswordResetTokens_TokenHash] UNIQUE NONCLUSTERED
(
	[TokenHash] ASC
) ON [PRIMARY],
 CONSTRAINT [FK_PasswordResetTokens_AspNetUsers] FOREIGN KEY([UserId])
	REFERENCES [dbo].[AspNetUsers] ([UserId]) ON DELETE CASCADE
) ON [PRIMARY]
GO
CREATE INDEX [IX_PasswordResetTokens_UserId] ON [dbo].[PasswordResetTokens] ([UserId])
GO
/****** Object:  Table [dbo].[BaptismRecords]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[BaptismRecords](
	[BaptismId] [int] IDENTITY(1,1) NOT NULL,
	[RegistryNumber] [nvarchar](50) NOT NULL,
	[ChildFirstName] [nvarchar](100) NOT NULL,
	[ChildMiddleName] [nvarchar](100) NULL,
	[ChildLastName] [nvarchar](100) NOT NULL,
	[DateOfBirth] [date] NOT NULL,
	[PlaceOfBirth] [nvarchar](200) NULL,
	[DateOfBaptism] [date] NOT NULL,
	[FatherFullName] [nvarchar](200) NULL,
	[MotherFullName] [nvarchar](200) NULL,
	[MinisterName] [nvarchar](200) NOT NULL,
	[Sponsors] [nvarchar](max) NULL,
	[Remarks] [nvarchar](max) NULL,
	[ScannedDocumentUrl] [nvarchar](1000) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [nvarchar](256) NOT NULL,
 CONSTRAINT [PK_BaptismRecords] PRIMARY KEY CLUSTERED
(
	[BaptismId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[BaptismRequestDetail]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[BaptismRequestDetail](
	[ServiceRequestId] [int] NOT NULL,
	[ChildFirstName] [nvarchar](200) NULL,
	[ChildMiddleName] [nvarchar](200) NULL,
	[ChildLastName] [nvarchar](200) NULL,
	[ChildDateOfBirth] [date] NULL,
	[PlaceOfBirth] [nvarchar](300) NULL,
	[FatherFullName] [nvarchar](300) NULL,
	[MotherFullName] [nvarchar](300) NULL,
	[GodfatherName] [nvarchar](300) NULL,
	[GodmotherName] [nvarchar](300) NULL,
	[ExtraFieldsJson] [nvarchar](max) NULL,
 CONSTRAINT [PK_BaptismRequestDetail] PRIMARY KEY CLUSTERED
(
	[ServiceRequestId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[BlockedSlots]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[BlockedSlots](
	[BlockedSlotId] [int] IDENTITY(1,1) NOT NULL,
	[BlockDate] [date] NOT NULL,
	[BlockTime] [varchar](5) NULL,
	[Scope] [varchar](20) NOT NULL,
	[ServiceId] [int] NULL,
	[Reason] [nvarchar](300) NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_BlockedSlots] PRIMARY KEY CLUSTERED
(
	[BlockedSlotId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CertificateRequestDocuments]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CertificateRequestDocuments](
	[CertificateRequestDocumentId] [int] IDENTITY(1,1) NOT NULL,
	[CertificateRequestId] [int] NOT NULL,
	[OriginalFileName] [nvarchar](255) NOT NULL,
	[StoredFileName] [nvarchar](255) NOT NULL,
	[FileUrl] [nvarchar](500) NOT NULL,
	[MimeType] [varchar](100) NOT NULL,
	[FileSizeBytes] [int] NOT NULL,
	[UploadedAt] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_CertificateRequestDocuments] PRIMARY KEY CLUSTERED
(
	[CertificateRequestDocumentId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CertificateRequests]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CertificateRequests](
	[CertificateRequestId] [int] IDENTITY(1,1) NOT NULL,
	[AccountId] [int] NULL,
	[CertificateType] [varchar](30) NOT NULL,
	[PreferredDate] [date] NOT NULL,
	[PreferredTime] [varchar](10) NOT NULL,
	[Status] [varchar](30) NOT NULL,
	[Notes] [nvarchar](1000) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[ContactEmail] [varchar](255) NULL,
	[ContactPhone] [varchar](50) NULL,
	[FirstName] [nvarchar](100) NULL,
	[LastName] [nvarchar](100) NULL,
	[ReferenceCode] [varchar](10) NULL,
 CONSTRAINT [PK_CertificateRequests] PRIMARY KEY CLUSTERED
(
	[CertificateRequestId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ConfirmationRecords]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ConfirmationRecords](
	[ConfirmationId] [int] IDENTITY(1,1) NOT NULL,
	[RegistryNumber] [nvarchar](50) NOT NULL,
	[CandidateFirstName] [nvarchar](100) NOT NULL,
	[CandidateMiddleName] [nvarchar](100) NULL,
	[CandidateLastName] [nvarchar](100) NOT NULL,
	[DateOfBirth] [date] NOT NULL,
	[DateOfConfirmation] [date] NOT NULL,
	[FatherFullName] [nvarchar](200) NULL,
	[MotherFullName] [nvarchar](200) NULL,
	[SponsorName] [nvarchar](200) NULL,
	[BishopOrMinister] [nvarchar](200) NOT NULL,
	[ParishOfBaptism] [nvarchar](200) NULL,
	[ScannedDocumentUrl] [nvarchar](1000) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [nvarchar](256) NOT NULL,
 CONSTRAINT [PK_ConfirmationRecords] PRIMARY KEY CLUSTERED
(
	[ConfirmationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ConfirmationRequestDetail]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ConfirmationRequestDetail](
	[ServiceRequestId] [int] NOT NULL,
	[CandidateFirstName] [nvarchar](200) NULL,
	[CandidateMiddleName] [nvarchar](200) NULL,
	[CandidateLastName] [nvarchar](200) NULL,
	[CandidateDateOfBirth] [date] NULL,
	[SponsorName] [nvarchar](300) NULL,
	[ParishOfBaptism] [nvarchar](300) NULL,
	[ExtraFieldsJson] [nvarchar](max) NULL,
 CONSTRAINT [PK_ConfirmationRequestDetail] PRIMARY KEY CLUSTERED
(
	[ServiceRequestId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ContactMessages]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ContactMessages](
	[ContactMessageId] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Email] [nvarchar](320) NOT NULL,
	[Phone] [nvarchar](50) NULL,
	[Message] [nvarchar](max) NOT NULL,
	[IsRead] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_ContactMessages] PRIMARY KEY CLUSTERED
(
	[ContactMessageId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DeathRecords]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DeathRecords](
	[DeathId] [int] IDENTITY(1,1) NOT NULL,
	[RegistryNumber] [nvarchar](50) NOT NULL,
	[DeceasedFirstName] [nvarchar](100) NOT NULL,
	[DeceasedMiddleName] [nvarchar](100) NULL,
	[DeceasedLastName] [nvarchar](100) NOT NULL,
	[Age] [int] NULL,
	[DateOfDeath] [date] NOT NULL,
	[DateOfBurial] [date] NULL,
	[CauseOfDeath] [nvarchar](200) NULL,
	[PlaceOfBurial] [nvarchar](200) NULL,
	[SacramentsReceived] [nvarchar](500) NULL,
	[OfficiatingPriest] [nvarchar](200) NOT NULL,
	[ScannedDocumentUrl] [nvarchar](1000) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [nvarchar](256) NOT NULL,
 CONSTRAINT [PK_DeathRecords] PRIMARY KEY CLUSTERED
(
	[DeathId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Employees]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Employees](
	[EmployeeId] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[FirstName] [nvarchar](255) NOT NULL,
	[LastName] [nvarchar](255) NOT NULL,
	[MobileNumber] [nvarchar](50) NULL,
	[Address] [nvarchar](255) NULL,
	[DateOfBirth] [date] NULL,
	[PositionId] [int] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED
(
	[EmployeeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_Employees_UserId] UNIQUE NONCLUSTERED
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Events]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Events](
	[EventId] [int] IDENTITY(1,1) NOT NULL,
	[Title] [nvarchar](255) NOT NULL,
	[Body] [nvarchar](max) NULL,
	[EventDate] [date] NULL,
	[EventTime] [time](7) NULL,
	[Location] [nvarchar](255) NULL,
	[CreatedBy] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[PhotoUrl] [nvarchar](1000) NULL,
	[Description] [nvarchar](max) NULL,
	[TitleTl] [nvarchar](510) NULL,
	[DescriptionTl] [nvarchar](max) NULL,
	[BodyTl] [nvarchar](max) NULL,
	[LocationTl] [nvarchar](510) NULL,
PRIMARY KEY CLUSTERED
(
	[EventId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[FinanceReportSnapshots]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[FinanceReportSnapshots](
	[FinanceReportSnapshotId] [int] IDENTITY(1,1) NOT NULL,
	[ReportType] [varchar](20) NOT NULL,
	[PeriodStart] [date] NOT NULL,
	[PeriodEnd] [date] NOT NULL,
	[TotalIncome] [decimal](14, 2) NOT NULL,
	[TotalExpenses] [decimal](14, 2) NOT NULL,
	[NetTotal] [decimal](14, 2) NOT NULL,
	[Details] [nvarchar](max) NOT NULL,
	[GeneratedAt] [datetime2](7) NOT NULL,
	[GeneratedBy] [nvarchar](256) NOT NULL,
 CONSTRAINT [PK_FinanceReportSnapshots] PRIMARY KEY CLUSTERED
(
	[FinanceReportSnapshotId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_FinanceReportSnapshots_Period] UNIQUE NONCLUSTERED
(
	[ReportType] ASC,
	[PeriodStart] ASC,
	[PeriodEnd] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[FinancialEntries]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[FinancialEntries](
	[FinancialEntryId] [int] IDENTITY(1,1) NOT NULL,
	[EntryDate] [date] NOT NULL,
	[EntryType] [varchar](30) NOT NULL,
	[Description] [nvarchar](500) NOT NULL,
	[Amount] [decimal](12, 2) NOT NULL,
	[ReferenceType] [varchar](30) NULL,
	[ReferenceId] [int] NULL,
	[EnteredBy] [nvarchar](256) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[Status] [varchar](30) NOT NULL,
	[ApprovedBy] [nvarchar](256) NULL,
	[ApprovedAt] [datetime2](7) NULL,
	[ReconciledBy] [nvarchar](256) NULL,
	[ReconciledAt] [datetime2](7) NULL,
 CONSTRAINT [PK_FinancialEntries] PRIMARY KEY CLUSTERED
(
	[FinancialEntryId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[FinancialEntryAudit]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[FinancialEntryAudit](
	[AuditId] [int] IDENTITY(1,1) NOT NULL,
	[FinancialEntryId] [int] NOT NULL,
	[ActionName] [varchar](30) NOT NULL,
	[ChangedBy] [nvarchar](256) NOT NULL,
	[ChangedAt] [datetime2](7) NOT NULL,
	[Details] [nvarchar](max) NULL,
 CONSTRAINT [PK_FinancialEntryAudit] PRIMARY KEY CLUSTERED
(
	[AuditId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[FuneralRequestDetail]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[FuneralRequestDetail](
	[ServiceRequestId] [int] NOT NULL,
	[DeceasedFirstName] [nvarchar](200) NULL,
	[DeceasedMiddleName] [nvarchar](200) NULL,
	[DeceasedLastName] [nvarchar](200) NULL,
	[DateOfDeath] [date] NULL,
	[RelationshipToDeceased] [nvarchar](200) NULL,
	[PlaceOfWake] [nvarchar](300) NULL,
	[ExtraFieldsJson] [nvarchar](max) NULL,
 CONSTRAINT [PK_FuneralRequestDetail] PRIMARY KEY CLUSTERED
(
	[ServiceRequestId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[HouseBlessingRequestDetail]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[HouseBlessingRequestDetail](
	[ServiceRequestId] [int] NOT NULL,
	[FullAddress] [nvarchar](500) NULL,
	[Landmark] [nvarchar](300) NULL,
	[PreferredContactPerson] [nvarchar](300) NULL,
	[ExtraFieldsJson] [nvarchar](max) NULL,
 CONSTRAINT [PK_HouseBlessingRequestDetail] PRIMARY KEY CLUSTERED
(
	[ServiceRequestId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MarriageRecords]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MarriageRecords](
	[MarriageId] [int] IDENTITY(1,1) NOT NULL,
	[RegistryNumber] [nvarchar](50) NOT NULL,
	[GroomFirstName] [nvarchar](100) NOT NULL,
	[GroomMiddleName] [nvarchar](100) NULL,
	[GroomLastName] [nvarchar](100) NOT NULL,
	[GroomAge] [int] NULL,
	[GroomParents] [nvarchar](200) NULL,
	[BrideFirstName] [nvarchar](100) NOT NULL,
	[BrideMiddleName] [nvarchar](100) NULL,
	[BrideLastName] [nvarchar](100) NOT NULL,
	[BrideAge] [int] NULL,
	[BrideParents] [nvarchar](200) NULL,
	[DateOfMarriage] [date] NOT NULL,
	[Witnesses] [nvarchar](max) NULL,
	[SolemnizingPriest] [nvarchar](200) NOT NULL,
	[ScannedDocumentUrl] [nvarchar](1000) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[CreatedBy] [nvarchar](256) NOT NULL,
 CONSTRAINT [PK_MarriageRecords] PRIMARY KEY CLUSTERED
(
	[MarriageId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MarriageRequestDetail]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MarriageRequestDetail](
	[ServiceRequestId] [int] NOT NULL,
	[GroomFirstName] [nvarchar](200) NULL,
	[GroomMiddleName] [nvarchar](200) NULL,
	[GroomLastName] [nvarchar](200) NULL,
	[GroomAge] [int] NULL,
	[BrideFirstName] [nvarchar](200) NULL,
	[BrideMiddleName] [nvarchar](200) NULL,
	[BrideLastName] [nvarchar](200) NULL,
	[BrideAge] [int] NULL,
	[CenomarNumber] [nvarchar](100) NULL,
	[Witnesses] [nvarchar](max) NULL,
	[ExtraFieldsJson] [nvarchar](max) NULL,
 CONSTRAINT [PK_MarriageRequestDetail] PRIMARY KEY CLUSTERED
(
	[ServiceRequestId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MassIntentions]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MassIntentions](
	[MassIntentionId] [int] IDENTITY(1,1) NOT NULL,
	[IntentionDate] [date] NOT NULL,
	[IntentionTime] [varchar](10) NOT NULL,
	[Offering] [decimal](12, 2) NOT NULL,
	[RequestedBy] [nvarchar](200) NOT NULL,
	[IntentionText] [nvarchar](1000) NOT NULL,
	[Status] [varchar](30) NOT NULL,
	[CreatedBy] [nvarchar](256) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_MassIntentions] PRIMARY KEY CLUSTERED
(
	[MassIntentionId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MassSchedule]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MassSchedule](
	[MassScheduleId] [int] IDENTITY(1,1) NOT NULL,
	[Title] [nvarchar](200) NOT NULL,
	[MassDate] [date] NOT NULL,
	[MassTime] [varchar](10) NOT NULL,
	[Location] [nvarchar](255) NOT NULL,
	[PriestUsername] [varchar](256) NOT NULL,
	[Notes] [nvarchar](1000) NULL,
	[Status] [varchar](30) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_MassSchedule] PRIMARY KEY CLUSTERED
(
	[MassScheduleId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ParishionerAccounts]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ParishionerAccounts](
	[AccountId] [int] IDENTITY(1,1) NOT NULL,
	[ParishionerId] [int] NOT NULL,
	[EmailAddress] [varchar](255) NOT NULL,
	[PasswordHash] [nvarchar](500) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[LastLoginAt] [datetime2](7) NULL,
 CONSTRAINT [PK_ParishionerAccounts] PRIMARY KEY CLUSTERED
(
	[AccountId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_ParishionerAccounts_Email] UNIQUE NONCLUSTERED
(
	[EmailAddress] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_ParishionerAccounts_Parishioner] UNIQUE NONCLUSTERED
(
	[ParishionerId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ParishionerPortalSessions]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ParishionerPortalSessions](
	[SessionToken] [varchar](64) NOT NULL,
	[AccountId] [int] NOT NULL,
	[ExpiresAt] [datetime2](7) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_ParishionerPortalSessions] PRIMARY KEY CLUSTERED
(
	[SessionToken] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Parishioners]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Parishioners](
	[ParishionerId] [int] IDENTITY(1,1) NOT NULL,
	[FirstName] [nvarchar](255) NOT NULL,
	[LastName] [nvarchar](255) NOT NULL,
	[EmailAddress] [nvarchar](255) NULL,
	[MobileNumber] [nvarchar](50) NULL,
	[Address] [nvarchar](255) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED
(
	[ParishionerId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Position]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Position](
	[PositionId] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](255) NOT NULL,
PRIMARY KEY CLUSTERED
(
	[PositionId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PrayerRequests]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PrayerRequests](
	[PrayerId] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](255) NULL,
	[Category] [nvarchar](50) NULL,
	[Request] [nvarchar](max) NULL,
	[Anonymous] [bit] NULL,
	[ShareWithCommunity] [bit] NULL,
	[IsApproved] [bit] NULL,
	[CreatedAt] [datetime] NULL,
PRIMARY KEY CLUSTERED
(
	[PrayerId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Priest]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Priest](
	[PriestId] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[Name] [nvarchar](255) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED
(
	[PriestId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_Priest_UserId] UNIQUE NONCLUSTERED
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SacramentalArchives]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SacramentalArchives](
	[ArchiveId] [int] IDENTITY(1,1) NOT NULL,
	[SacramentType] [varchar](30) NOT NULL,
	[BookNumber] [int] NOT NULL,
	[PageNumber] [int] NOT NULL,
	[FileUrl] [nvarchar](1000) NOT NULL,
	[Notes] [nvarchar](max) NULL,
	[UploadedAt] [datetime2](7) NOT NULL,
	[UploadedBy] [nvarchar](256) NOT NULL,
 CONSTRAINT [PK_SacramentalArchives] PRIMARY KEY CLUSTERED
(
	[ArchiveId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SacramentalRecordAudit]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SacramentalRecordAudit](
	[AuditId] [int] IDENTITY(1,1) NOT NULL,
	[RecordType] [varchar](30) NOT NULL,
	[RecordId] [int] NOT NULL,
	[ActionName] [varchar](20) NOT NULL,
	[ChangedBy] [nvarchar](256) NOT NULL,
	[ChangedAt] [datetime2](7) NOT NULL,
	[Changes] [nvarchar](max) NULL,
 CONSTRAINT [PK_SacramentalRecordAudit] PRIMARY KEY CLUSTERED
(
	[AuditId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Service]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Service](
	[ServiceId] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](255) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[IsActive] [bit] NOT NULL,
PRIMARY KEY CLUSTERED
(
	[ServiceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ServiceFieldDefinition]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ServiceFieldDefinition](
	[FieldDefinitionId] [int] IDENTITY(1,1) NOT NULL,
	[ServiceId] [int] NOT NULL,
	[FieldKey] [varchar](100) NOT NULL,
	[Label] [nvarchar](200) NOT NULL,
	[FieldType] [varchar](20) NOT NULL,
	[OptionsJson] [nvarchar](max) NULL,
	[IsRequired] [bit] NOT NULL,
	[SortOrder] [int] NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_ServiceFieldDefinition] PRIMARY KEY CLUSTERED
(
	[FieldDefinitionId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ServiceRequest]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ServiceRequest](
	[ServiceRequestId] [int] IDENTITY(1,1) NOT NULL,
	[ParishionerId] [int] NOT NULL,
	[ServiceId] [int] NOT NULL,
	[PriestId] [int] NULL,
	[RequestDate] [datetime2](7) NOT NULL,
	[ScheduledDate] [date] NULL,
	[ScheduledTime] [time](7) NULL,
	[Venue] [nvarchar](255) NULL,
	[Status] [nvarchar](100) NOT NULL,
	[Notes] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[ContactFirstName] [nvarchar](100) NULL,
	[ContactLastName] [nvarchar](100) NULL,
	[ContactEmail] [nvarchar](255) NULL,
	[ContactMobile] [nvarchar](20) NULL,
	[ContactAddress] [nvarchar](max) NULL,
	[AttendanceStatus] [varchar](30) NULL,
	[AttendanceMarkedAt] [datetime2](7) NULL,
	[VoidedAt] [datetime2](7) NULL,
	[ActiveSlotKey] [nvarchar](100) NULL,
PRIMARY KEY CLUSTERED
(
	[ServiceRequestId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SiteContent]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SiteContent](
	[ContentKey] [nvarchar](50) NOT NULL,
	[ContentJson] [nvarchar](max) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedBy] [nvarchar](256) NULL,
 CONSTRAINT [PK_SiteContent] PRIMARY KEY CLUSTERED
(
	[ContentKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserManagementAudit]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserManagementAudit](
	[AuditId] [int] IDENTITY(1,1) NOT NULL,
	[ActionName] [varchar](40) NOT NULL,
	[TargetUserId] [int] NULL,
	[TargetUserName] [nvarchar](256) NULL,
	[ChangedBy] [nvarchar](256) NOT NULL,
	[ChangedAt] [datetime2](7) NOT NULL,
	[Details] [nvarchar](max) NULL,
 CONSTRAINT [PK_UserManagementAudit] PRIMARY KEY CLUSTERED
(
	[AuditId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserModulePermissions]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserModulePermissions](
	[UserId] [int] NOT NULL,
	[ModuleName] [nvarchar](50) NOT NULL,
	[CanView] [bit] NOT NULL,
	[CanEdit] [bit] NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedBy] [nvarchar](512) NULL,
 CONSTRAINT [PK_UserModulePermissions] PRIMARY KEY CLUSTERED
(
	[UserId] ASC,
	[ModuleName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[VerificationTokens]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[VerificationTokens](
	[TokenId] [int] IDENTITY(1,1) NOT NULL,
	[Token] [varchar](64) NOT NULL,
	[ServiceRequestId] [int] NOT NULL,
	[ExpiresAt] [datetime2](7) NOT NULL,
	[Used] [bit] NOT NULL,
	[UsedAt] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_VerificationTokens] PRIMARY KEY CLUSTERED
(
	[TokenId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_VerificationTokens_Token] UNIQUE NONCLUSTERED
(
	[Token] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Index [IX_ApplicationEditLog_Request]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_ApplicationEditLog_Request] ON [dbo].[ApplicationEditLog]
(
	[ServiceRequestId] ASC,
	[ChangedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_AspNetUserRoles_RoleId]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_AspNetUserRoles_RoleId] ON [dbo].[AspNetUserRoles]
(
	[RoleId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_BaptismRecords_ChildName]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_BaptismRecords_ChildName] ON [dbo].[BaptismRecords]
(
	[ChildLastName] ASC,
	[ChildFirstName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_BaptismRecords_DateOfBaptism]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_BaptismRecords_DateOfBaptism] ON [dbo].[BaptismRecords]
(
	[DateOfBaptism] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_BaptismRecords_RegistryNumber]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [IX_BaptismRecords_RegistryNumber] ON [dbo].[BaptismRecords]
(
	[RegistryNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_BlockedSlots_BlockDate]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_BlockedSlots_BlockDate] ON [dbo].[BlockedSlots]
(
	[BlockDate] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_CertificateRequestDocuments_Request]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_CertificateRequestDocuments_Request] ON [dbo].[CertificateRequestDocuments]
(
	[CertificateRequestId] ASC,
	[UploadedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_CertificateRequests_Account]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_CertificateRequests_Account] ON [dbo].[CertificateRequests]
(
	[AccountId] ASC,
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_CertificateRequests_Appointment]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_CertificateRequests_Appointment] ON [dbo].[CertificateRequests]
(
	[PreferredDate] ASC,
	[PreferredTime] ASC,
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UQ_CertificateRequests_RefCode]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UQ_CertificateRequests_RefCode] ON [dbo].[CertificateRequests]
(
	[ReferenceCode] ASC
)
WHERE ([ReferenceCode] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_ConfirmationRecords_CandidateName]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_ConfirmationRecords_CandidateName] ON [dbo].[ConfirmationRecords]
(
	[CandidateLastName] ASC,
	[CandidateFirstName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ConfirmationRecords_DateOfConfirmation]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_ConfirmationRecords_DateOfConfirmation] ON [dbo].[ConfirmationRecords]
(
	[DateOfConfirmation] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_ConfirmationRecords_RegistryNumber]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [IX_ConfirmationRecords_RegistryNumber] ON [dbo].[ConfirmationRecords]
(
	[RegistryNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_DeathRecords_DateOfDeath]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_DeathRecords_DateOfDeath] ON [dbo].[DeathRecords]
(
	[DateOfDeath] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_DeathRecords_DeceasedName]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_DeathRecords_DeceasedName] ON [dbo].[DeathRecords]
(
	[DeceasedLastName] ASC,
	[DeceasedFirstName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_DeathRecords_RegistryNumber]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [IX_DeathRecords_RegistryNumber] ON [dbo].[DeathRecords]
(
	[RegistryNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Employees_PositionId]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_Employees_PositionId] ON [dbo].[Employees]
(
	[PositionId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Employees_UserId]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_Employees_UserId] ON [dbo].[Employees]
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Events_CreatedBy]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_Events_CreatedBy] ON [dbo].[Events]
(
	[CreatedBy] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_FinanceReportSnapshots_Period]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_FinanceReportSnapshots_Period] ON [dbo].[FinanceReportSnapshots]
(
	[ReportType] ASC,
	[PeriodStart] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_FinancialEntries_DateType]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_FinancialEntries_DateType] ON [dbo].[FinancialEntries]
(
	[EntryDate] ASC,
	[EntryType] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_FinancialEntryAudit_Entry]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_FinancialEntryAudit_Entry] ON [dbo].[FinancialEntryAudit]
(
	[FinancialEntryId] ASC,
	[ChangedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_MarriageRecords_DateOfMarriage]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_MarriageRecords_DateOfMarriage] ON [dbo].[MarriageRecords]
(
	[DateOfMarriage] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_MarriageRecords_GroomBrideName]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_MarriageRecords_GroomBrideName] ON [dbo].[MarriageRecords]
(
	[GroomLastName] ASC,
	[BrideLastName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_MarriageRecords_RegistryNumber]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [IX_MarriageRecords_RegistryNumber] ON [dbo].[MarriageRecords]
(
	[RegistryNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_MassIntentions_DateTime]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_MassIntentions_DateTime] ON [dbo].[MassIntentions]
(
	[IntentionDate] ASC,
	[IntentionTime] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_MassSchedule_PriestDate]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_MassSchedule_PriestDate] ON [dbo].[MassSchedule]
(
	[PriestUsername] ASC,
	[MassDate] ASC,
	[MassTime] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_ParishionerAccounts_Email]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_ParishionerAccounts_Email] ON [dbo].[ParishionerAccounts]
(
	[EmailAddress] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ParishionerPortalSessions_Account]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_ParishionerPortalSessions_Account] ON [dbo].[ParishionerPortalSessions]
(
	[AccountId] ASC,
	[ExpiresAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Parishioners_LastName]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_Parishioners_LastName] ON [dbo].[Parishioners]
(
	[LastName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Priest_UserId]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_Priest_UserId] ON [dbo].[Priest]
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SacramentalArchives_BookPage]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_SacramentalArchives_BookPage] ON [dbo].[SacramentalArchives]
(
	[SacramentType] ASC,
	[BookNumber] ASC,
	[PageNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SacramentalArchives_SacramentType]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_SacramentalArchives_SacramentType] ON [dbo].[SacramentalArchives]
(
	[SacramentType] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SacramentalRecordAudit_Record]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_SacramentalRecordAudit_Record] ON [dbo].[SacramentalRecordAudit]
(
	[RecordType] ASC,
	[RecordId] ASC,
	[ChangedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_ServiceFieldDefinition_ServiceKey]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [IX_ServiceFieldDefinition_ServiceKey] ON [dbo].[ServiceFieldDefinition]
(
	[ServiceId] ASC,
	[FieldKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ServiceRequest_ParishionerId]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_ServiceRequest_ParishionerId] ON [dbo].[ServiceRequest]
(
	[ParishionerId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ServiceRequest_PriestId]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_ServiceRequest_PriestId] ON [dbo].[ServiceRequest]
(
	[PriestId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_ServiceRequest_ServiceId]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_ServiceRequest_ServiceId] ON [dbo].[ServiceRequest]
(
	[ServiceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_ServiceRequest_ActiveSlot]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_ServiceRequest_ActiveSlot] ON [dbo].[ServiceRequest]
(
	[ActiveSlotKey] ASC
)
WHERE ([ActiveSlotKey] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_UserManagementAudit_ChangedAt]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_UserManagementAudit_ChangedAt] ON [dbo].[UserManagementAudit]
(
	[ChangedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_UserManagementAudit_TargetUser]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_UserManagementAudit_TargetUser] ON [dbo].[UserManagementAudit]
(
	[TargetUserId] ASC,
	[ChangedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_VerificationTokens_ExpiresAt]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_VerificationTokens_ExpiresAt] ON [dbo].[VerificationTokens]
(
	[ExpiresAt] ASC
)
WHERE ([Used]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_VerificationTokens_Token]    Script Date: 10/19/2026 10:50:42 PM ******/
CREATE NONCLUSTERED INDEX [IX_VerificationTokens_Token] ON [dbo].[VerificationTokens]
(
	[Token] ASC
)
WHERE ([Used]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [dbo].[ApplicationEditLog] ADD  CONSTRAINT [DF_ApplicationEditLog_ChangedAt]  DEFAULT (sysutcdatetime()) FOR [ChangedAt]
GO
ALTER TABLE [dbo].[AspNetUsers] ADD  DEFAULT ((0)) FOR [EmailConfirmed]
GO
ALTER TABLE [dbo].[AspNetUsers] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[AspNetUsers] ADD  CONSTRAINT [DF_AspNetUsers_MustChangePassword]  DEFAULT ((0)) FOR [MustChangePassword]
GO
ALTER TABLE [dbo].[BaptismRecords] ADD  CONSTRAINT [DF_BaptismRecords_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[BaptismRecords] ADD  CONSTRAINT [DF_BaptismRecords_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[BlockedSlots] ADD  CONSTRAINT [DF_BlockedSlots_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[CertificateRequestDocuments] ADD  CONSTRAINT [DF_CertificateRequestDocuments_UploadedAt]  DEFAULT (sysutcdatetime()) FOR [UploadedAt]
GO
ALTER TABLE [dbo].[CertificateRequests] ADD  CONSTRAINT [DF_CertificateRequests_Status]  DEFAULT ('Requested') FOR [Status]
GO
ALTER TABLE [dbo].[CertificateRequests] ADD  CONSTRAINT [DF_CertificateRequests_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[CertificateRequests] ADD  CONSTRAINT [DF_CertificateRequests_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[ConfirmationRecords] ADD  CONSTRAINT [DF_ConfirmationRecords_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[ConfirmationRecords] ADD  CONSTRAINT [DF_ConfirmationRecords_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[ContactMessages] ADD  CONSTRAINT [DF_ContactMessages_IsRead]  DEFAULT ((0)) FOR [IsRead]
GO
ALTER TABLE [dbo].[ContactMessages] ADD  CONSTRAINT [DF_ContactMessages_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[DeathRecords] ADD  CONSTRAINT [DF_DeathRecords_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[DeathRecords] ADD  CONSTRAINT [DF_DeathRecords_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Employees] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Events] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[FinanceReportSnapshots] ADD  CONSTRAINT [DF_FinanceReportSnapshots_GeneratedAt]  DEFAULT (sysutcdatetime()) FOR [GeneratedAt]
GO
ALTER TABLE [dbo].[FinancialEntries] ADD  CONSTRAINT [DF_FinancialEntries_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[FinancialEntries] ADD  CONSTRAINT [DF_FinancialEntries_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[FinancialEntries] ADD  CONSTRAINT [DF_FinancialEntries_Status]  DEFAULT ('Draft') FOR [Status]
GO
ALTER TABLE [dbo].[FinancialEntryAudit] ADD  CONSTRAINT [DF_FinancialEntryAudit_ChangedAt]  DEFAULT (sysutcdatetime()) FOR [ChangedAt]
GO
ALTER TABLE [dbo].[MarriageRecords] ADD  CONSTRAINT [DF_MarriageRecords_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[MarriageRecords] ADD  CONSTRAINT [DF_MarriageRecords_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[MassIntentions] ADD  CONSTRAINT [DF_MassIntentions_Offering]  DEFAULT ((0)) FOR [Offering]
GO
ALTER TABLE [dbo].[MassIntentions] ADD  CONSTRAINT [DF_MassIntentions_Status]  DEFAULT ('Scheduled') FOR [Status]
GO
ALTER TABLE [dbo].[MassIntentions] ADD  CONSTRAINT [DF_MassIntentions_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[MassIntentions] ADD  CONSTRAINT [DF_MassIntentions_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[MassSchedule] ADD  CONSTRAINT [DF_MassSchedule_Status]  DEFAULT ('Scheduled') FOR [Status]
GO
ALTER TABLE [dbo].[MassSchedule] ADD  CONSTRAINT [DF_MassSchedule_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[MassSchedule] ADD  CONSTRAINT [DF_MassSchedule_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[ParishionerAccounts] ADD  CONSTRAINT [DF_ParishionerAccounts_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[ParishionerAccounts] ADD  CONSTRAINT [DF_ParishionerAccounts_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[ParishionerPortalSessions] ADD  CONSTRAINT [DF_ParishionerPortalSessions_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Parishioners] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[PrayerRequests] ADD  DEFAULT ((0)) FOR [Anonymous]
GO
ALTER TABLE [dbo].[PrayerRequests] ADD  DEFAULT ((0)) FOR [ShareWithCommunity]
GO
ALTER TABLE [dbo].[PrayerRequests] ADD  DEFAULT ((0)) FOR [IsApproved]
GO
ALTER TABLE [dbo].[PrayerRequests] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Priest] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SacramentalArchives] ADD  CONSTRAINT [DF_SacramentalArchives_UploadedAt]  DEFAULT (sysutcdatetime()) FOR [UploadedAt]
GO
ALTER TABLE [dbo].[SacramentalRecordAudit] ADD  CONSTRAINT [DF_SacramentalRecordAudit_ChangedAt]  DEFAULT (sysutcdatetime()) FOR [ChangedAt]
GO
ALTER TABLE [dbo].[Service] ADD  CONSTRAINT [DF_Service_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[ServiceFieldDefinition] ADD  CONSTRAINT [DF_ServiceFieldDefinition_FieldType]  DEFAULT ('text') FOR [FieldType]
GO
ALTER TABLE [dbo].[ServiceFieldDefinition] ADD  CONSTRAINT [DF_ServiceFieldDefinition_IsRequired]  DEFAULT ((0)) FOR [IsRequired]
GO
ALTER TABLE [dbo].[ServiceFieldDefinition] ADD  CONSTRAINT [DF_ServiceFieldDefinition_SortOrder]  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[ServiceFieldDefinition] ADD  CONSTRAINT [DF_ServiceFieldDefinition_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[ServiceFieldDefinition] ADD  CONSTRAINT [DF_ServiceFieldDefinition_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[ServiceRequest] ADD  DEFAULT (sysutcdatetime()) FOR [RequestDate]
GO
ALTER TABLE [dbo].[ServiceRequest] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[ServiceRequest] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SiteContent] ADD  CONSTRAINT [DF_SiteContent_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[UserManagementAudit] ADD  CONSTRAINT [DF_UserManagementAudit_ChangedAt]  DEFAULT (sysutcdatetime()) FOR [ChangedAt]
GO
ALTER TABLE [dbo].[UserModulePermissions] ADD  CONSTRAINT [DF_UserModulePermissions_CanView]  DEFAULT ((0)) FOR [CanView]
GO
ALTER TABLE [dbo].[UserModulePermissions] ADD  CONSTRAINT [DF_UserModulePermissions_CanEdit]  DEFAULT ((0)) FOR [CanEdit]
GO
ALTER TABLE [dbo].[UserModulePermissions] ADD  CONSTRAINT [DF_UserModulePermissions_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[VerificationTokens] ADD  CONSTRAINT [DF_VerificationTokens_Used]  DEFAULT ((0)) FOR [Used]
GO
ALTER TABLE [dbo].[VerificationTokens] ADD  CONSTRAINT [DF_VerificationTokens_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[AspNetUserRoles]  WITH CHECK ADD  CONSTRAINT [FK_AspNetUserRoles_AspNetRoles] FOREIGN KEY([RoleId])
REFERENCES [dbo].[AspNetRoles] ([RoleId])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[AspNetUserRoles] CHECK CONSTRAINT [FK_AspNetUserRoles_AspNetRoles]
GO
ALTER TABLE [dbo].[AspNetUserRoles]  WITH CHECK ADD  CONSTRAINT [FK_AspNetUserRoles_AspNetUsers] FOREIGN KEY([UserId])
REFERENCES [dbo].[AspNetUsers] ([UserId])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[AspNetUserRoles] CHECK CONSTRAINT [FK_AspNetUserRoles_AspNetUsers]
GO
ALTER TABLE [dbo].[BaptismRequestDetail]  WITH CHECK ADD  CONSTRAINT [FK_BaptismRequestDetail_ServiceRequest] FOREIGN KEY([ServiceRequestId])
REFERENCES [dbo].[ServiceRequest] ([ServiceRequestId])
GO
ALTER TABLE [dbo].[BaptismRequestDetail] CHECK CONSTRAINT [FK_BaptismRequestDetail_ServiceRequest]
GO
ALTER TABLE [dbo].[CertificateRequestDocuments]  WITH CHECK ADD  CONSTRAINT [FK_CertificateRequestDocuments_Request] FOREIGN KEY([CertificateRequestId])
REFERENCES [dbo].[CertificateRequests] ([CertificateRequestId])
GO
ALTER TABLE [dbo].[CertificateRequestDocuments] CHECK CONSTRAINT [FK_CertificateRequestDocuments_Request]
GO
ALTER TABLE [dbo].[ConfirmationRequestDetail]  WITH CHECK ADD  CONSTRAINT [FK_ConfirmationRequestDetail_ServiceRequest] FOREIGN KEY([ServiceRequestId])
REFERENCES [dbo].[ServiceRequest] ([ServiceRequestId])
GO
ALTER TABLE [dbo].[ConfirmationRequestDetail] CHECK CONSTRAINT [FK_ConfirmationRequestDetail_ServiceRequest]
GO
ALTER TABLE [dbo].[Employees]  WITH CHECK ADD  CONSTRAINT [FK_Employees_AspNetUsers] FOREIGN KEY([UserId])
REFERENCES [dbo].[AspNetUsers] ([UserId])
GO
ALTER TABLE [dbo].[Employees] CHECK CONSTRAINT [FK_Employees_AspNetUsers]
GO
ALTER TABLE [dbo].[Employees]  WITH CHECK ADD  CONSTRAINT [FK_Employees_Position] FOREIGN KEY([PositionId])
REFERENCES [dbo].[Position] ([PositionId])
GO
ALTER TABLE [dbo].[Employees] CHECK CONSTRAINT [FK_Employees_Position]
GO
ALTER TABLE [dbo].[Events]  WITH CHECK ADD  CONSTRAINT [FK_Events_Employees] FOREIGN KEY([CreatedBy])
REFERENCES [dbo].[Employees] ([EmployeeId])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[Events] CHECK CONSTRAINT [FK_Events_Employees]
GO
ALTER TABLE [dbo].[FuneralRequestDetail]  WITH CHECK ADD  CONSTRAINT [FK_FuneralRequestDetail_ServiceRequest] FOREIGN KEY([ServiceRequestId])
REFERENCES [dbo].[ServiceRequest] ([ServiceRequestId])
GO
ALTER TABLE [dbo].[FuneralRequestDetail] CHECK CONSTRAINT [FK_FuneralRequestDetail_ServiceRequest]
GO
ALTER TABLE [dbo].[HouseBlessingRequestDetail]  WITH CHECK ADD  CONSTRAINT [FK_HouseBlessingRequestDetail_ServiceRequest] FOREIGN KEY([ServiceRequestId])
REFERENCES [dbo].[ServiceRequest] ([ServiceRequestId])
GO
ALTER TABLE [dbo].[HouseBlessingRequestDetail] CHECK CONSTRAINT [FK_HouseBlessingRequestDetail_ServiceRequest]
GO
ALTER TABLE [dbo].[MarriageRequestDetail]  WITH CHECK ADD  CONSTRAINT [FK_MarriageRequestDetail_ServiceRequest] FOREIGN KEY([ServiceRequestId])
REFERENCES [dbo].[ServiceRequest] ([ServiceRequestId])
GO
ALTER TABLE [dbo].[MarriageRequestDetail] CHECK CONSTRAINT [FK_MarriageRequestDetail_ServiceRequest]
GO
ALTER TABLE [dbo].[Priest]  WITH CHECK ADD  CONSTRAINT [FK_Priest_AspNetUsers] FOREIGN KEY([UserId])
REFERENCES [dbo].[AspNetUsers] ([UserId])
GO
ALTER TABLE [dbo].[Priest] CHECK CONSTRAINT [FK_Priest_AspNetUsers]
GO
ALTER TABLE [dbo].[ServiceFieldDefinition]  WITH CHECK ADD  CONSTRAINT [FK_ServiceFieldDefinition_Service] FOREIGN KEY([ServiceId])
REFERENCES [dbo].[Service] ([ServiceId])
GO
ALTER TABLE [dbo].[ServiceFieldDefinition] CHECK CONSTRAINT [FK_ServiceFieldDefinition_Service]
GO
ALTER TABLE [dbo].[ServiceRequest]  WITH CHECK ADD  CONSTRAINT [FK_ServiceRequest_Parishioners] FOREIGN KEY([ParishionerId])
REFERENCES [dbo].[Parishioners] ([ParishionerId])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[ServiceRequest] CHECK CONSTRAINT [FK_ServiceRequest_Parishioners]
GO
ALTER TABLE [dbo].[ServiceRequest]  WITH CHECK ADD  CONSTRAINT [FK_ServiceRequest_Priest] FOREIGN KEY([PriestId])
REFERENCES [dbo].[Priest] ([PriestId])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[ServiceRequest] CHECK CONSTRAINT [FK_ServiceRequest_Priest]
GO
ALTER TABLE [dbo].[ServiceRequest]  WITH CHECK ADD  CONSTRAINT [FK_ServiceRequest_Service] FOREIGN KEY([ServiceId])
REFERENCES [dbo].[Service] ([ServiceId])
GO
ALTER TABLE [dbo].[ServiceRequest] CHECK CONSTRAINT [FK_ServiceRequest_Service]
GO
ALTER TABLE [dbo].[UserModulePermissions]  WITH CHECK ADD  CONSTRAINT [FK_UserModulePermissions_User] FOREIGN KEY([UserId])
REFERENCES [dbo].[AspNetUsers] ([UserId])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[UserModulePermissions] CHECK CONSTRAINT [FK_UserModulePermissions_User]
GO
ALTER TABLE [dbo].[VerificationTokens]  WITH CHECK ADD  CONSTRAINT [FK_VerificationTokens_ServiceRequest] FOREIGN KEY([ServiceRequestId])
REFERENCES [dbo].[ServiceRequest] ([ServiceRequestId])
GO
ALTER TABLE [dbo].[VerificationTokens] CHECK CONSTRAINT [FK_VerificationTokens_ServiceRequest]
GO
ALTER TABLE [dbo].[BlockedSlots]  WITH CHECK ADD  CONSTRAINT [CK_BlockedSlots_Scope] CHECK  (([Scope]='Certificate' OR [Scope]='Service' OR [Scope]='All'))
GO
ALTER TABLE [dbo].[BlockedSlots] CHECK CONSTRAINT [CK_BlockedSlots_Scope]
GO
ALTER TABLE [dbo].[BlockedSlots]  WITH CHECK ADD  CONSTRAINT [CK_BlockedSlots_ServiceId] CHECK  (([Scope]='Service' AND [ServiceId] IS NOT NULL OR [Scope]<>'Service' AND [ServiceId] IS NULL))
GO
ALTER TABLE [dbo].[BlockedSlots] CHECK CONSTRAINT [CK_BlockedSlots_ServiceId]
GO
ALTER TABLE [dbo].[FinanceReportSnapshots]  WITH CHECK ADD  CONSTRAINT [CK_FinanceReportSnapshots_Type] CHECK  (([ReportType]='Monthly' OR [ReportType]='Weekly'))
GO
ALTER TABLE [dbo].[FinanceReportSnapshots] CHECK CONSTRAINT [CK_FinanceReportSnapshots_Type]
GO
/****** Object:  Trigger [dbo].[trg_BaptismRecords_UpdatedAt]    Script Date: 10/19/2026 10:50:42 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE TRIGGER [dbo].[trg_BaptismRecords_UpdatedAt]
ON [dbo].[BaptismRecords]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE br
    SET br.UpdatedAt = SYSUTCDATETIME()
    FROM dbo.BaptismRecords br
    INNER JOIN inserted i ON br.BaptismId = i.BaptismId;
END;
GO
ALTER TABLE [dbo].[BaptismRecords] ENABLE TRIGGER [trg_BaptismRecords_UpdatedAt]
GO
/****** Object:  Trigger [dbo].[trg_ConfirmationRecords_UpdatedAt]    Script Date: 10/19/2026 10:50:44 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE TRIGGER [dbo].[trg_ConfirmationRecords_UpdatedAt]
ON [dbo].[ConfirmationRecords]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE cr
    SET cr.UpdatedAt = SYSUTCDATETIME()
    FROM dbo.ConfirmationRecords cr
    INNER JOIN inserted i ON cr.ConfirmationId = i.ConfirmationId;
END;
GO
ALTER TABLE [dbo].[ConfirmationRecords] ENABLE TRIGGER [trg_ConfirmationRecords_UpdatedAt]
GO
/****** Object:  Trigger [dbo].[trg_DeathRecords_UpdatedAt]    Script Date: 10/19/2026 10:50:46 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE TRIGGER [dbo].[trg_DeathRecords_UpdatedAt]
ON [dbo].[DeathRecords]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dr
    SET dr.UpdatedAt = SYSUTCDATETIME()
    FROM dbo.DeathRecords dr
    INNER JOIN inserted i ON dr.DeathId = i.DeathId;
END;
GO
ALTER TABLE [dbo].[DeathRecords] ENABLE TRIGGER [trg_DeathRecords_UpdatedAt]
GO
/****** Object:  Trigger [dbo].[trg_MarriageRecords_UpdatedAt]    Script Date: 10/19/2026 10:50:48 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE TRIGGER [dbo].[trg_MarriageRecords_UpdatedAt]
ON [dbo].[MarriageRecords]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE mr
    SET mr.UpdatedAt = SYSUTCDATETIME()
    FROM dbo.MarriageRecords mr
    INNER JOIN inserted i ON mr.MarriageId = i.MarriageId;
END;
GO
ALTER TABLE [dbo].[MarriageRecords] ENABLE TRIGGER [trg_MarriageRecords_UpdatedAt]
GO
/****** Object:  Trigger [dbo].[trg_ServiceRequest_ActiveSlotKey]    Script Date: 10/19/2026 10:50:50 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

    CREATE TRIGGER [dbo].[trg_ServiceRequest_ActiveSlotKey]
    ON [dbo].[ServiceRequest]
    AFTER INSERT, UPDATE
    AS
    BEGIN
        SET NOCOUNT ON;
        UPDATE sr
        SET ActiveSlotKey = CASE WHEN sr.Status IN ('PendingVerification', 'Confirmed')
            THEN CONVERT(NVARCHAR(20), sr.ServiceId) + N'|' + CONVERT(NVARCHAR(10), sr.ScheduledDate, 23) + N'|' + CONVERT(NVARCHAR(8), sr.ScheduledTime, 108)
            ELSE NULL END
        FROM dbo.ServiceRequest sr
        INNER JOIN inserted i ON i.ServiceRequestId = sr.ServiceRequestId
        WHERE ISNULL(sr.ActiveSlotKey, N'') <> ISNULL(CASE WHEN sr.Status IN ('PendingVerification', 'Confirmed')
            THEN CONVERT(NVARCHAR(20), sr.ServiceId) + N'|' + CONVERT(NVARCHAR(10), sr.ScheduledDate, 23) + N'|' + CONVERT(NVARCHAR(8), sr.ScheduledTime, 108)
            ELSE NULL END, N'');
    END;
GO
ALTER TABLE [dbo].[ServiceRequest] ENABLE TRIGGER [trg_ServiceRequest_ActiveSlotKey]
GO
